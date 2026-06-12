import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/surveys/$surveyId/edit')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: SurveyBuilder,
})

function useLoadFont(fontFamily: string) {
  useEffect(() => {
    if (!fontFamily) return
    const fontId = `google-font-${fontFamily.toLowerCase().replace(/\s+/g, '-')}`
    if (document.getElementById(fontId)) return

    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'

    let fontName = fontFamily
    if (fontFamily === 'JetBrains Mono') {
      fontName = 'JetBrains+Mono'
    }

    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;700;800&display=swap`
    document.head.appendChild(link)
  }, [fontFamily])
}

interface Question {
  id: string
  type: 'short_text' | 'multiple_choice' | 'rating' | 'number' | 'checkbox' | 'date_picker'
  label: string
  options: string[]
  required: boolean
  order_index: number
}

interface Survey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  font_family: string
  created_at: string
}

const PRESET_COLORS = [
  '#3b82f6', // Electric Blue
  '#10b981', // Emerald Green
  '#8b5cf6', // Deep Purple
  '#f59e0b', // Amber Orange
  '#ef4444', // Sunset Red
  '#ec4899', // Pink Magenta
]

function SurveyBuilder() {
  const { surveyId } = Route.useParams()
  const _auth = useAuth()
  const navigate = useNavigate()

  const [_survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Title, Brand Color, and Logo local state
  const [title, setTitle] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [logoUrl, setLogoUrl] = useState('')
  const [fontFamily, setFontFamily] = useState('Manrope')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useLoadFont(fontFamily)

  useEffect(() => {
    async function loadSurveyDetails() {
      try {
        const response = await fetch(`/api/surveys/${surveyId}`)
        if (response.ok) {
          const data = (await response.json()) as { survey: Survey; questions: Question[] }
          setSurvey(data.survey)
          setTitle(data.survey.title)
          setPrimaryColor(data.survey.primary_color || '#3b82f6')
          setLogoUrl(data.survey.logo_url || '')
          setFontFamily(data.survey.font_family || 'Manrope')
          setQuestions(data.questions || [])
        } else {
          setError('Failed to load survey details. It may not exist.')
        }
      } catch (err) {
        console.error('Failed to load survey details:', err)
        setError('An error occurred while loading survey details.')
      } finally {
        setLoading(false)
      }
    }

    loadSurveyDetails()
  }, [surveyId])

  const handleAddQuestion = (
    type: 'short_text' | 'multiple_choice' | 'rating' | 'number' | 'checkbox' | 'date_picker',
  ) => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      type,
      label:
        type === 'short_text'
          ? 'Describe your feedback'
          : type === 'multiple_choice'
            ? 'Select an option'
            : type === 'rating'
              ? 'How would you rate your experience?'
              : type === 'number'
                ? 'Enter a number'
                : type === 'checkbox'
                  ? 'Select options'
                  : 'Select a date',
      options: type === 'multiple_choice' || type === 'checkbox' ? ['Option 1', 'Option 2'] : [],
      required: false,
      order_index: questions.length,
    }
    setQuestions([...questions, newQuestion])
  }

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter((q) => q.id !== id)
    // Re-index remaining questions
    const reindexed = updated.map((q, idx) => ({
      ...q,
      order_index: idx,
    }))
    setQuestions(reindexed)
  }

  const handleUpdateQuestionLabel = (id: string, label: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, label } : q)))
  }

  const handleToggleRequired = (id: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, required: !q.required } : q)))
  }

  // Multiple Choice option actions
  const handleAddOption = (questionId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, `Option ${q.options.length + 1}`],
          }
        }
        return q
      }),
    )
  }

  const handleUpdateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const updatedOptions = [...q.options]
          updatedOptions[optionIndex] = value
          return {
            ...q,
            options: updatedOptions,
          }
        }
        return q
      }),
    )
  }

  const handleDeleteOption = (questionId: string, optionIndex: number) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const updatedOptions = q.options.filter((_, idx) => idx !== optionIndex)
          return {
            ...q,
            options: updatedOptions,
          }
        }
        return q
      }),
    )
  }

  // Reordering questions
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === questions.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...questions]
    const currentQ = updated[index]
    const targetQ = updated[targetIndex]

    if (currentQ !== undefined && targetQ !== undefined) {
      updated[index] = targetQ
      updated[targetIndex] = currentQ
    }

    const reordered = updated.map((q, idx) => ({
      ...q,
      order_index: idx,
    }))
    setQuestions(reordered)
  }

  const handleSave = async () => {
    setSaveLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Survey',
          primary_color: primaryColor,
          logo_url: logoUrl.trim(),
          font_family: fontFamily,
          questions,
        }),
      })

      if (response.ok) {
        setSuccess('Survey builder changes saved successfully!')
        setTimeout(() => setSuccess(''), 4000)
      } else {
        const errData = (await response.json()) as { error?: string }
        setError(errData.error || 'Failed to save survey changes.')
      }
    } catch (err) {
      console.error('Failed to save survey details:', err)
      setError('A connection error occurred while saving.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDeleteSurvey = () => {
    setDeleteModalOpen(true)
  }

  const confirmDeleteSurvey = async () => {
    setDeleteModalOpen(false)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        navigate({ to: '/dashboard' })
      } else {
        setError('Failed to delete survey.')
      }
    } catch (err) {
      console.error('Failed to delete survey:', err)
      setError('A connection error occurred while deleting.')
    }
  }

  if (loading) {
    return (
      <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex flex-col justify-center items-center gap-4">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
          progress_activity
        </span>
        <span className="text-[14px] font-mono uppercase tracking-wider text-on-surface-variant">
          Loading survey workspace...
        </span>
      </div>
    )
  }

  return (
    <div className="bg-[#f8fafc] dark:bg-[#101415] text-[#1e293b] dark:text-[#e0e3e5] min-h-screen flex flex-col font-sans antialiased overflow-x-hidden relative select-none transition-colors duration-300">
      {/* Radial ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-500"
        style={{
          background:
            theme === 'dark'
              ? `radial-gradient(circle at 70% 10%, ${primaryColor}15 0%, #101415 70%)`
              : `radial-gradient(circle at 70% 10%, ${primaryColor}10 0%, #f8fafc 70%)`,
        }}
      />

      {/* Builder Top Bar */}
      <header className="sticky top-0 w-full z-40 bg-white/85 dark:bg-[#101415]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 flex justify-between items-center h-16 px-6 relative transition-colors duration-300">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-slate-500 dark:text-on-surface-variant hover:text-slate-800 dark:hover:text-on-surface text-[12px] font-mono uppercase tracking-wider transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block" />
          <h1 className="font-extrabold text-[16px] tracking-tight text-slate-800 dark:text-[#e0e3e5] hidden sm:block">
            Builder workspace
          </h1>
        </div>

        <div className="flex items-center gap-3">
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

          <a
            href={`/s/${surveyId}`}
            target="_blank"
            rel="noreferrer"
            className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-on-surface text-[12px] font-mono uppercase tracking-wider py-2 px-4 rounded transition-colors border border-slate-200 dark:border-white/5 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>Preview</span>
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveLoading}
            className="bg-primary hover:bg-primary-container text-[#002e6a] text-[12px] font-mono uppercase tracking-wider py-2 px-5 rounded transition-all flex items-center gap-1.5 disabled:opacity-50 h-[36px] font-bold shadow-[0_0_20px_rgba(173,198,255,0.2)]"
            style={{ backgroundColor: primaryColor }}
          >
            {saveLoading ? (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>Save Builder</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10">
        {/* Left Settings Sidebar */}
        <aside className="w-full lg:w-[360px] bg-white dark:bg-[#151c26]/60 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/5 p-6 flex flex-col gap-6 transition-colors duration-300">
          <div>
            <h2 className="text-[12px] font-mono uppercase tracking-widest text-slate-500 dark:text-on-surface-variant mb-4">
              Survey Branding
            </h2>
            <div className="flex flex-col gap-5">
              {/* Title input */}
              <div className="flex flex-col gap-2">
                <label
                  className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant"
                  htmlFor="surveyTitle"
                >
                  Survey Title
                </label>
                <input
                  id="surveyTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., Customer Loyalty Survey"
                  className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-800 dark:text-on-surface focus:outline-none focus:border-primary transition-colors text-[14px]"
                />
              </div>

              {/* Logo URL input */}
              <div className="flex flex-col gap-2">
                <label
                  className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant"
                  htmlFor="logoUrl"
                >
                  Logo Image URL
                </label>
                <input
                  id="logoUrl"
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-800 dark:text-on-surface focus:outline-none focus:border-primary transition-colors text-[14px]"
                />
                {logoUrl && (
                  <div className="mt-2 w-full p-3 rounded-lg border border-white/5 bg-black/20 flex justify-center items-center">
                    <img
                      src={logoUrl}
                      alt="Brand Logo Preview"
                      className="max-h-12 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Theme Primary Color picker */}
              <div className="flex flex-col gap-2">
                <label
                  className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant"
                  htmlFor="colorHex"
                >
                  Branding Accent Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPrimaryColor(color)}
                      className="w-8 h-8 rounded-full border transition-all flex items-center justify-center"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          primaryColor === color
                            ? theme === 'dark'
                              ? '#ffffff'
                              : '#000000'
                            : 'transparent',
                        boxShadow: primaryColor === color ? '0 0 10px rgba(0, 0, 0, 0.15)' : 'none',
                      }}
                    >
                      {primaryColor === color && (
                        <span className="material-symbols-outlined text-white dark:text-white text-[18px]">
                          check
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    id="colorHex"
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-3 py-2 text-slate-800 dark:text-on-surface focus:outline-none focus:border-primary transition-colors text-[14px] font-mono"
                  />
                  <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded border border-slate-200 dark:border-white/25"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
              </div>

              {/* Font Family Picker */}
              <div className="flex flex-col gap-2 relative">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
                  Brand Font Family
                </span>
                <button
                  type="button"
                  onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                  className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-left text-slate-800 dark:text-on-surface focus:outline-none focus:border-primary transition-colors text-[14px] flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {fontFamily === 'Manrope' && 'Manrope (Modern Sans)'}
                    {fontFamily === 'Inter' && 'Inter (Clean Sans)'}
                    {fontFamily === 'Outfit' && 'Outfit (Geometric)'}
                    {fontFamily === 'Roboto' && 'Roboto (Classic Sans)'}
                    {fontFamily === 'JetBrains Mono' && 'JetBrains Mono (Technical)'}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${fontDropdownOpen ? 'rotate-180' : ''}`}
                  >
                    keyboard_arrow_down
                  </span>
                </button>

                {fontDropdownOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close font selector"
                      className="fixed inset-0 z-40 bg-transparent w-full h-full cursor-default"
                      onClick={() => setFontDropdownOpen(false)}
                    />
                    <div className="absolute bottom-[calc(100%+4px)] left-0 w-full bg-white dark:bg-[#1a1f21] border border-slate-200 dark:border-white/10 rounded-lg shadow-lg py-1 z-50 animate-fade-in max-h-60 overflow-y-auto">
                      {[
                        { value: 'Manrope', label: 'Manrope (Modern Sans)' },
                        { value: 'Inter', label: 'Inter (Clean Sans)' },
                        { value: 'Outfit', label: 'Outfit (Geometric)' },
                        { value: 'Roboto', label: 'Roboto (Classic Sans)' },
                        { value: 'JetBrains Mono', label: 'JetBrains Mono (Technical)' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFontFamily(opt.value)
                            setFontDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-between ${
                            fontFamily === opt.value
                              ? 'text-primary font-semibold bg-slate-50/50 dark:bg-white/5'
                              : 'text-slate-700 dark:text-on-surface'
                          }`}
                          style={{ fontFamily: `'${opt.value}', sans-serif` }}
                        >
                          <span>{opt.label}</span>
                          {fontFamily === opt.value && (
                            <span className="material-symbols-outlined text-[16px] text-primary">
                              check
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Delete workspace area */}
          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5">
            <button
              type="button"
              onClick={handleDeleteSurvey}
              className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-[12px] font-mono uppercase tracking-wider transition-colors border border-red-200 dark:border-red-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Delete Survey</span>
            </button>
          </div>
        </aside>

        {/* Center Canvas Workspace */}
        <main
          className="flex-grow p-6 md:p-8 overflow-y-auto max-w-[960px] mx-auto w-full flex flex-col gap-6"
          style={{ fontFamily: `'${fontFamily}', sans-serif` }}
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-[14px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-[14px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {/* Header & Tool Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200/80 dark:border-white/5">
            <div>
              <h2 className="font-extrabold text-[24px] tracking-tight text-slate-800 dark:text-on-surface">
                Survey Structure
              </h2>
              <p className="text-[13px] text-slate-500 dark:text-on-surface-variant mt-0.5">
                Add, reorder, and configure your questions for respondents.
              </p>
            </div>

            {/* Add question controls */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleAddQuestion('short_text')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">short_text</span>
                <span>+ Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('multiple_choice')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">radio_button_checked</span>
                <span>+ Choice</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('checkbox')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check_box</span>
                <span>+ Checkbox</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('rating')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">star</span>
                <span>+ Rating</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('number')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">tag</span>
                <span>+ Number</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('date_picker')}
                className="flex-1 sm:flex-initial bg-[#adc6ff]/20 hover:bg-[#adc6ff]/45 text-[#00285d] border border-[#adc6ff]/30 dark:bg-white/5 dark:hover:bg-white/10 dark:text-on-surface dark:border-white/5 text-[11px] font-mono uppercase tracking-wider py-2 px-3.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>+ Date</span>
              </button>
            </div>
          </div>

          {/* Questions Canvas list */}
          {questions.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-12 text-center flex flex-col items-center gap-4 bg-white/[0.01]">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant animate-pulse">
                playlist_add
              </span>
              <div>
                <h3 className="font-bold text-[16px] text-on-surface mb-0.5">
                  Your survey is empty
                </h3>
                <p className="text-on-surface-variant text-[13px] max-w-[280px]">
                  Click one of the buttons above to add your first question field.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="rounded-xl p-6 relative overflow-hidden transition-all duration-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none"
                >
                  <div
                    className="absolute left-0 top-0 h-full w-[4px]"
                    style={{ backgroundColor: primaryColor }}
                  />

                  {/* Question Header Card Control */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-slate-500 dark:text-on-surface-variant">
                        Q{index + 1}
                      </span>
                      <span className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-500 dark:text-on-surface-variant px-2 py-0.5 rounded uppercase">
                        {q.type.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Order Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface disabled:opacity-20"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                        className="w-8 h-8 rounded hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface disabled:opacity-20"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_downward
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="w-8 h-8 rounded hover:bg-red-500/10 flex items-center justify-center text-on-surface-variant hover:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Edit Field Question Label */}
                  <div className="flex flex-col gap-2 mb-4">
                    <label
                      className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant"
                      htmlFor={`qLabel-${q.id}`}
                    >
                      Question Text
                    </label>
                    <input
                      id={`qLabel-${q.id}`}
                      type="text"
                      value={q.label}
                      onChange={(e) => handleUpdateQuestionLabel(q.id, e.target.value)}
                      placeholder="Write your question..."
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-slate-800 dark:text-on-surface focus:outline-none focus:border-slate-300 dark:focus:border-white/20 transition-colors text-[14px]"
                    />
                  </div>

                  {/* Question Sub-Configurations */}
                  {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                    <div className="flex flex-col gap-2.5 mb-5 p-4 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
                        Options List
                      </span>
                      <div className="flex flex-col gap-2">
                        {q.options.map((opt, optIdx) => {
                          return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: options are simple strings that may be duplicates/empty during editing
                            <div key={`${q.id}-opt-${optIdx}`} className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-on-surface-variant">
                                {q.type === 'checkbox'
                                  ? 'check_box_outline_blank'
                                  : 'radio_button_unchecked'}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                                className="flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-1.5 text-slate-800 dark:text-on-surface focus:outline-none text-[13px]"
                              />
                              {q.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(q.id, optIdx)}
                                  className="w-8 h-8 text-slate-400 dark:text-on-surface-variant hover:text-red-400 flex items-center justify-center"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    close
                                  </span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddOption(q.id)}
                        className="mt-2 text-left self-start text-[11px] font-mono uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
                        style={{ color: primaryColor }}
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Add Option</span>
                      </button>
                    </div>
                  )}

                  {q.type === 'rating' && (
                    <div className="mb-5 p-4 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant block mb-3">
                        Interactive Scale Preview
                      </span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <div
                            key={val}
                            className="w-10 h-10 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center font-mono text-[14px] text-slate-500 dark:text-on-surface-variant"
                          >
                            {val}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'short_text' && (
                    <div className="mb-5 p-4 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant block mb-2">
                        Input Preview
                      </span>
                      <div className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg h-9 px-3 flex items-center text-slate-400 dark:text-on-surface-variant text-[13px]">
                        User answers will be typed here...
                      </div>
                    </div>
                  )}

                  {q.type === 'number' && (
                    <div className="mb-5 p-4 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant block mb-2">
                        Number Input Preview
                      </span>
                      <div className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg h-9 px-3 flex items-center text-slate-400 dark:text-on-surface-variant text-[13px] gap-2">
                        <span className="material-symbols-outlined text-[16px]">tag</span>
                        <span>User numbers will be entered here...</span>
                      </div>
                    </div>
                  )}

                  {q.type === 'date_picker' && (
                    <div className="mb-5 p-4 rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant block mb-2">
                        Date Picker Preview
                      </span>
                      <div className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg h-9 px-3 flex items-center text-slate-400 dark:text-on-surface-variant text-[13px] gap-2">
                        <span className="material-symbols-outlined text-[16px]">
                          calendar_today
                        </span>
                        <span>User date will be selected here...</span>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Controls */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={() => handleToggleRequired(q.id)}
                        className="rounded border-slate-300 dark:border-white/10 text-primary bg-slate-50 dark:bg-black/40 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-[12px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
                        Mandatory Required Field
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-[440px] rounded-xl p-6 relative overflow-hidden bg-white dark:bg-[#151c26]/95 border border-red-500/20 shadow-[0_8px_32px_0_rgba(239,68,68,0.1)] dark:shadow-[0_8px_32px_0_rgba(239,68,68,0.15)]"
            style={{ fontFamily: `'${fontFamily}', sans-serif` }}
          >
            <div
              className="absolute inset-0 pointer-events-none z-0 opacity-10"
              style={{
                background: 'radial-gradient(circle at 50% 50%, #ef4444 0%, transparent 60%)',
              }}
            />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500 dark:text-red-400">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>

              <h3 className="font-extrabold text-[18px] text-slate-800 dark:text-on-surface mb-2">
                Delete Survey?
              </h3>

              <p className="text-[13px] text-slate-500 dark:text-on-surface-variant mb-6 leading-relaxed">
                Are you absolutely sure you want to delete{' '}
                <strong className="text-slate-800 dark:text-on-surface">
                  {title || 'this survey'}
                </strong>
                ? All questions, responses, and submissions will be lost forever. This action cannot
                be undone.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 py-2 px-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-on-surface text-[12px] font-mono uppercase tracking-wider rounded-lg border border-slate-200 dark:border-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSurvey}
                  className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-[12px] font-mono uppercase tracking-wider rounded-lg transition-colors font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
