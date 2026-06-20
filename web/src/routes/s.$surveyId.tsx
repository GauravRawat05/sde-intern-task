// ==============================================================================
// PUBLIC SURVEY RESPONDENT SCREEN (s.$surveyId.tsx)
// ==============================================================================
// This route component is unauthenticated, allowing guest users to answer
// survey questions. It fetches survey structures and styles (branding color/fonts),
// manages individual input changes, runs front-end validation check validations, 
// and submits responses to the backend API.
// ==============================================================================

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTheme } from '../lib/theme'

// Register the public survey submission path `/s/$surveyId` with TanStack Router.
export const Route = createFileRoute('/s/$surveyId')({
  component: PublicSurvey,
})

/**
 * useLoadFont - Custom React Hook to fetch and inject Google Font stylesheets 
 * dynamically into the document head based on active survey branding settings.
 */
function useLoadFont(fontFamily: string) {
  useEffect(() => {
    if (!fontFamily) return
    const fontId = `google-font-${fontFamily.toLowerCase().replace(/\s+/g, '-')}`
    if (document.getElementById(fontId)) return

    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'

    // Format font query params for Google API compatibility
    let fontName = fontFamily
    if (fontFamily === 'JetBrains Mono') {
      fontName = 'JetBrains+Mono'
    }

    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;700;800&display=swap`
    document.head.appendChild(link)
  }, [fontFamily])
}

// Question interface representing frontend input items.
interface Question {
  id: string
  type: 'short_text' | 'multiple_choice' | 'rating' | 'number' | 'checkbox' | 'date_picker'
  label: string
  options: string[]
  required: boolean
  order_index: number
}

// Survey metadata interface representing backend styles.
interface Survey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  font_family?: string
}

/**
 * PublicSurvey - Renders the survey respondent canvas.
 * Manages question rendering loops, active answer mappings, and API submission.
 */
function PublicSurvey() {
  const { surveyId } = Route.useParams()

  // State parameters
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Fetch and inject specified Google Font dynamically
  useLoadFont(survey?.font_family || 'Manrope')

  // UX Feedback states
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Validation & Error states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [isSurveyClosed, setIsSurveyClosed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  // Load public survey structure and configurations on mount.
  // Handles HTTP 403 Forbidden specifically when survey is closed/unpublished.
  useEffect(() => {
    async function loadPublicSurvey() {
      try {
        const response = await fetch(`/api/public/surveys/${surveyId}`)
        if (response.ok) {
          const data = (await response.json()) as { survey: Survey; questions: Question[] }
          setSurvey(data.survey)
          setQuestions(data.questions || [])

          // Pre-populate empty answer strings for each question.
          const initialAnswers: Record<string, string> = {}
          for (const q of data.questions) {
            initialAnswers[q.id] = ''
          }
          setAnswers(initialAnswers)
        } else if (response.status === 403) {
          // Locked survey configuration returned by backend.
          const errData = (await response.json()) as {
            error?: string
            isClosed?: boolean
            survey?: Survey
          }
          setServerError(errData.error || 'This survey is currently closed.')
          setIsSurveyClosed(true)
          if (errData.survey) {
            setSurvey(errData.survey)
          }
        } else {
          setServerError('This survey is either private or does not exist.')
        }
      } catch (err) {
        console.error('Failed to load public survey:', err)
        setServerError('Could not connect to the survey server.')
      } finally {
        setLoading(false)
      }
    }

    loadPublicSurvey()
  }, [surveyId])

  /**
   * handleInputChange - Records answer inputs locally and clears active 
   * validation error blocks instantly upon correction.
   */
  const handleInputChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))

    // Clean error message flags dynamically
    if (errors[questionId] && value.trim() !== '') {
      setErrors((prev) => {
        const copy = { ...prev }
        delete copy[questionId]
        return copy
      })
    }
  }

  /**
   * validateForm - Audits required field states.
   * Returns true if all criteria are satisfied, false otherwise.
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    for (const q of questions) {
      const val = answers[q.id] || ''
      if (q.required && val.trim() === '') {
        newErrors[q.id] = 'This field is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * handleSubmit - Validates respondent entries, scrolls to the first error 
   * on failure, and executes POST requests to `/api/public/surveys/:id/responses` on success.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    // Validate entries before executing server calls
    if (!validateForm()) {
      // Find first invalid card element and scroll into viewport
      const firstErrorId = Object.keys(errors)[0]
      if (firstErrorId) {
        document.getElementById(`qCard-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }

    setSubmitting(true)

    // Form payload mapping
    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      questionId: qId,
      value: val,
    }))

    try {
      const response = await fetch(`/api/public/surveys/${surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers }),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const errData = (await response.json()) as { error?: string }
        setServerError(errData.error || 'Failed to submit your responses. Please try again.')
      }
    } catch (err) {
      console.error('Failed to submit survey answers:', err)
      setServerError('An error occurred during response submission.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex flex-col justify-center items-center gap-4 font-sans">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
          progress_activity
        </span>
        <span className="text-[14px] font-mono uppercase tracking-wider text-on-surface-variant">
          Loading survey...
        </span>
      </div>
    )
  }

  if (serverError && !survey) {
    return (
      <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-[480px] bg-white/5 border border-white/10 rounded-xl p-8 text-center backdrop-blur-xl">
          <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">
            sentiment_dissatisfied
          </span>
          <h2 className="font-extrabold text-[20px] mb-2">Survey Unavailable</h2>
          <p className="text-on-surface-variant text-[14px] mb-6">{serverError}</p>
          <a
            href="/"
            className="inline-block bg-white/10 hover:bg-white/15 text-on-surface text-[12px] font-mono uppercase tracking-wider py-2.5 px-6 rounded transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    )
  }

  const brandColor = survey?.primary_color || '#3b82f6'

  if (submitted) {
    return (
      <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Radial ambient glow matching brand */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${brandColor}18 0%, #101415 70%)`,
          }}
        />

        <div
          className="w-full max-w-[540px] rounded-xl p-10 text-center relative z-10 overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          }}
        >
          {survey?.logo_url && (
            <img
              src={survey.logo_url}
              alt="Brand Logo"
              className="max-h-12 object-contain mx-auto mb-6"
            />
          )}

          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6"
            style={{
              backgroundColor: `${brandColor}20`,
              border: `1px solid ${brandColor}50`,
            }}
          >
            <span className="material-symbols-outlined text-[36px]" style={{ color: brandColor }}>
              check_circle
            </span>
          </div>

          <h2 className="font-extrabold text-[28px] tracking-tight mb-2 text-on-surface">
            Feedback Submitted!
          </h2>
          <p className="text-on-surface-variant text-[15px] mb-8 max-w-[360px] mx-auto">
            Thank you for sharing your thoughts. Your anonymous response has been saved.
          </p>

          <div className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest">
            Powered by DoCoDeGo Survey
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-[#f8fafc] dark:bg-[#101415] text-[#1e293b] dark:text-[#e0e3e5] min-h-screen flex flex-col font-sans antialiased overflow-x-hidden relative select-none transition-colors duration-300"
      style={{ fontFamily: `'${survey?.font_family || 'Manrope'}', sans-serif` }}
    >
      {/* Radial ambient glow matching brand */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-500"
        style={{
          background:
            theme === 'dark'
              ? `radial-gradient(circle at 50% 0%, ${brandColor}15 0%, #101415 75%)`
              : `radial-gradient(circle at 50% 0%, ${brandColor}10 0%, #f8fafc 75%)`,
        }}
      />

      <div className="flex-grow flex flex-col items-center py-12 px-6 relative z-10">
        <div className="w-full max-w-[640px] flex justify-end mb-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface flex items-center justify-center transition-colors border border-black/5 dark:border-white/5 cursor-pointer"
            aria-label="Toggle Theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        {/* Survey Content */}
        {isSurveyClosed ? (
          <div className="w-full max-w-[640px] flex flex-col gap-8">
            {/* Survey Title Card Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200 dark:border-white/5">
              {survey?.logo_url && (
                <img
                  src={survey.logo_url}
                  alt="Brand Logo"
                  className="max-h-16 object-contain mb-5"
                />
              )}
              <h1 className="font-extrabold text-[32px] tracking-tight text-slate-800 dark:text-on-surface mb-2 leading-tight">
                {survey?.title}
              </h1>
              <p className="text-[14px] text-slate-500 dark:text-on-surface-variant max-w-[440px]">
                Closed Survey
              </p>
            </div>

            {/* Glassmorphic Panel indicating Closed Status */}
            <div className="rounded-xl p-8 text-center relative overflow-hidden transition-all duration-300 bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-lg backdrop-blur-xl">
              <div
                className="absolute left-0 top-0 h-full w-[4px]"
                style={{ backgroundColor: brandColor }}
              />
              <div
                className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4"
                style={{
                  backgroundColor: `${brandColor}15`,
                  border: `1px solid ${brandColor}40`,
                }}
              >
                <span
                  className="material-symbols-outlined text-[30px]"
                  style={{ color: brandColor }}
                >
                  lock
                </span>
              </div>
              <h3 className="font-bold text-[18px] text-slate-800 dark:text-on-surface mb-2">
                Survey is Closed
              </h3>
              <p className="text-slate-500 dark:text-on-surface-variant text-[14px] max-w-[380px] mx-auto leading-relaxed">
                {serverError ||
                  'This survey is currently closed and is no longer accepting submissions. Thank you for your interest!'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-[640px] flex flex-col gap-8">
            {/* Survey Title Card Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200 dark:border-white/5">
              {survey?.logo_url && (
                <img
                  src={survey.logo_url}
                  alt="Brand Logo"
                  className="max-h-16 object-contain mb-5"
                />
              )}
              <h1 className="font-extrabold text-[32px] tracking-tight text-slate-800 dark:text-on-surface mb-2 leading-tight">
                {survey?.title}
              </h1>
              <p className="text-[14px] text-slate-500 dark:text-on-surface-variant max-w-[440px]">
                Please answer the questions below. All submissions are secure and anonymous.
              </p>
            </div>

            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 text-[14px] flex items-center gap-3">
                <span className="material-symbols-outlined">error</span>
                <span>{serverError}</span>
              </div>
            )}

            {/* Survey Questions list */}
            <div className="flex flex-col gap-6">
              {questions.map((q) => {
                const hasError = !!errors[q.id]

                return (
                  <div
                    key={q.id}
                    id={`qCard-${q.id}`}
                    className="rounded-xl p-6 relative overflow-hidden transition-all duration-300 bg-white dark:bg-white/5 border shadow-sm dark:shadow-none"
                    style={{
                      borderColor: hasError
                        ? 'rgba(239, 68, 68, 0.4)'
                        : theme === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    {/* Left accent bar on active selection or default brand */}
                    <div
                      className="absolute left-0 top-0 h-full w-[4px]"
                      style={{ backgroundColor: hasError ? '#ef4444' : brandColor }}
                    />

                    {/* Question header */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-[18px] text-slate-800 dark:text-on-surface leading-snug">
                        {q.label}
                        {q.required && (
                          <span className="text-red-400 ml-1" title="Required field">
                            *
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Question body inputs based on question types */}
                    {q.type === 'short_text' && (
                      <div className="flex flex-col gap-1">
                        <textarea
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          placeholder="Type your response..."
                          rows={3}
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none transition-all duration-300 text-[14px]"
                          onFocus={(e) => {
                            e.target.style.borderColor = brandColor
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor =
                              theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </div>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="flex flex-col gap-3">
                        {q.options.map((opt) => {
                          const isSelected = answers[q.id] === opt
                          return (
                            <label
                              key={`${q.id}-opt-${opt}`}
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                            >
                              <input
                                type="radio"
                                name={`radio-${q.id}`}
                                checked={isSelected}
                                onChange={() => handleInputChange(q.id, opt)}
                                className="sr-only"
                              />
                              {/* Custom Radio Button */}
                              <div
                                className="w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200"
                                style={{
                                  borderColor: isSelected ? brandColor : 'rgba(156, 163, 175, 0.3)',
                                  backgroundColor: isSelected ? `${brandColor}20` : 'transparent',
                                }}
                              >
                                {isSelected && (
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: brandColor }}
                                  />
                                )}
                              </div>
                              <span className="text-[14px] text-slate-800 dark:text-on-surface">
                                {opt}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'rating' && (
                      <div className="flex flex-col items-center py-2">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((val) => {
                            const ratingStr = val.toString()
                            const isSelected = answers[q.id] === ratingStr
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleInputChange(q.id, ratingStr)}
                                className="w-12 h-12 rounded-lg border flex flex-col items-center justify-center font-mono text-[16px] font-bold transition-all duration-200"
                                style={{
                                  borderColor: isSelected
                                    ? brandColor
                                    : theme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.1)'
                                      : 'rgba(0, 0, 0, 0.08)',
                                  backgroundColor: isSelected
                                    ? `${brandColor}30`
                                    : theme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.02)'
                                      : 'rgba(0, 0, 0, 0.02)',
                                  color: isSelected
                                    ? theme === 'dark'
                                      ? '#ffffff'
                                      : brandColor
                                    : theme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.6)'
                                      : 'rgba(0, 0, 0, 0.5)',
                                  boxShadow: isSelected ? `0 0 15px ${brandColor}40` : 'none',
                                }}
                              >
                                {val}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {q.type === 'checkbox' && (
                      <div className="flex flex-col gap-3">
                        {q.options.map((opt) => {
                          const currentVal = answers[q.id] || ''
                          const selectedList = currentVal ? currentVal.split(', ') : []
                          const isSelected = selectedList.includes(opt)

                          const handleCheckboxToggle = () => {
                            let newList: string[]
                            if (isSelected) {
                              newList = selectedList.filter((item) => item !== opt)
                            } else {
                              newList = [...selectedList, opt]
                            }
                            handleInputChange(q.id, newList.join(', '))
                          }

                          return (
                            <label
                              key={`${q.id}-opt-${opt}`}
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={handleCheckboxToggle}
                                className="sr-only"
                              />
                              {/* Custom Checkbox Box */}
                              <div
                                className="w-5 h-5 rounded border flex items-center justify-center transition-all duration-200"
                                style={{
                                  borderColor: isSelected ? brandColor : 'rgba(156, 163, 175, 0.3)',
                                  backgroundColor: isSelected ? `${brandColor}20` : 'transparent',
                                }}
                              >
                                {isSelected && (
                                  <span
                                    className="material-symbols-outlined text-[16px]"
                                    style={{ color: brandColor }}
                                  >
                                    check
                                  </span>
                                )}
                              </div>
                              <span className="text-[14px] text-slate-800 dark:text-on-surface">
                                {opt}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'number' && (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          placeholder="Enter a numeric value..."
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none transition-all duration-300 text-[14px]"
                          onFocus={(e) => {
                            e.target.style.borderColor = brandColor
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor =
                              theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </div>
                    )}

                    {q.type === 'date_picker' && (
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2.5 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none transition-all duration-300 text-[14px]"
                          style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                          onFocus={(e) => {
                            e.target.style.borderColor = brandColor
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor =
                              theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </div>
                    )}

                    {/* Helper Error Label */}
                    {hasError && (
                      <div className="text-red-400 text-[12px] font-mono mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        <span>{errors[q.id]}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full text-on-primary py-3.5 px-4 font-mono tracking-wider uppercase text-[12px] transition-all duration-300 relative overflow-hidden group flex justify-center items-center h-[52px] rounded-lg font-bold"
              style={{
                backgroundColor: brandColor,
                opacity: submitting ? 0.7 : 1,
                boxShadow: `0 0 25px ${brandColor}30`,
              }}
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  <span>Submit Responses</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    send
                  </span>
                </span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Powered by footer */}
      <footer className="w-full bg-transparent mt-auto relative z-10 border-t border-slate-200 dark:border-white/5 py-6 flex justify-center">
        <span className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant">
          DoCoDeGo Security survey builder.
        </span>
      </footer>
    </div>
  )
}
