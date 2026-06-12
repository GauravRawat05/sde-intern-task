import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/surveys/$surveyId/responses')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: SurveyResponses,
})

interface Question {
  id: string
  type: 'short_text' | 'multiple_choice' | 'rating' | 'number' | 'checkbox' | 'date_picker'
  label: string
  options: string[]
}

interface ResponseLog {
  id: string
  created_at: string
  answers: Record<string, string>
}

interface Stats {
  totalResponses: number
  completionRate: number
  averageRating: number
}

interface Survey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  font_family?: string
}

function SurveyResponses() {
  const { surveyId } = Route.useParams()
  const auth = useAuth()

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<ResponseLog[]>([])
  const [stats, setStats] = useState<Stats>({
    totalResponses: 0,
    completionRate: 100,
    averageRating: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const handleExportCSV = () => {
    if (responses.length === 0) return

    const escapeCSV = (val: string) => {
      if (!val) return '""'
      const formatted = val.replace(/"/g, '""')
      return `"${formatted}"`
    }

    const headers = ['Submission Date', ...questions.map((q) => q.label)]
    const csvRows = [headers.map(escapeCSV).join(',')]

    for (const resp of responses) {
      const row = [
        new Date(resp.created_at).toLocaleString(),
        ...questions.map((q) => resp.answers[q.id] || ''),
      ]
      csvRows.push(row.map(escapeCSV).join(','))
    }

    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csvRows.join('\n'))}`
    const link = document.createElement('a')
    link.setAttribute('href', csvContent)
    link.setAttribute('download', `survey_responses_${surveyId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/s/${surveyId}`
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    async function loadResponses() {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/responses`)
        if (response.ok) {
          const data = (await response.json()) as {
            survey: Survey
            questions: Question[]
            stats: Stats
            responses: ResponseLog[]
          }
          setSurvey(data.survey)
          setQuestions(data.questions || [])
          setStats(data.stats)
          setResponses(data.responses || [])
        } else {
          setError('Failed to fetch responses. You may not be authorized to view this survey.')
        }
      } catch (err) {
        console.error('Failed to load survey responses:', err)
        setError('An error occurred while loading survey responses.')
      } finally {
        setLoading(false)
      }
    }

    loadResponses()
  }, [surveyId])

  const handleLogout = async () => {
    await auth.logout()
  }

  if (loading) {
    return (
      <div className="bg-[#f8fafc] dark:bg-[#101415] text-slate-800 dark:text-[#e0e3e5] min-h-screen flex flex-col justify-center items-center gap-4">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
          progress_activity
        </span>
        <span className="text-[14px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
          Loading responses analytics...
        </span>
      </div>
    )
  }

  const brandColor = survey?.primary_color || '#3b82f6'

  return (
    <div className="bg-[#f8fafc] dark:bg-[#101415] text-[#1e293b] dark:text-[#e0e3e5] min-h-screen flex font-sans antialiased overflow-x-hidden transition-colors duration-300">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-white dark:bg-[#191c1e] border-r border-slate-200/80 dark:border-white/5 flex flex-col p-6 gap-4 z-40 hidden md:flex transition-colors duration-300">
        <div className="mb-10 px-2 mt-4">
          <div className="text-[28px] font-extrabold tracking-tight text-slate-800 dark:text-on-surface">
            DoCoDeGo
          </div>
          <div className="text-slate-500 dark:text-on-surface-variant text-[12px] font-mono uppercase tracking-wider mt-1">
            Survey Dashboard
          </div>
        </div>

        <div className="flex-grow flex flex-col gap-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-on-surface-variant hover:text-slate-800 dark:hover:text-on-surface rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </Link>
          <Link
            to="/surveys/$surveyId/edit"
            params={{ surveyId }}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-on-surface-variant hover:text-slate-800 dark:hover:text-on-surface rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all"
          >
            <span className="material-symbols-outlined">edit</span>
            <span>Survey Builder</span>
          </Link>
        </div>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex flex-col px-3 py-2">
            <span className="text-[10px] font-mono text-slate-500 dark:text-on-surface-variant uppercase tracking-wider">
              Signed in as:
            </span>
            <span className="text-[12px] text-slate-700 dark:text-on-surface truncate font-medium">
              {auth.user?.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-red-500 dark:text-red-400 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-lg font-mono uppercase tracking-wider text-[12px] text-left transition-all w-full"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content frame */}
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen relative">
        {/* Ambient background glow */}
        <div
          className="absolute inset-0 pointer-events-none z-0 transition-all duration-300"
          style={{
            background:
              theme === 'dark'
                ? `radial-gradient(circle at 50% 0%, ${brandColor}15 0%, #101415 65%)`
                : `radial-gradient(circle at 50% 0%, ${brandColor}20 0%, #f8fafc 65%)`,
          }}
        />

        {/* Top Header */}
        <header className="sticky top-0 w-full z-30 bg-white/85 dark:bg-[#101415]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 flex justify-between items-center h-16 px-8 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[18px] text-slate-800 dark:text-on-surface hidden md:block">
              Results Analytics
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface flex items-center justify-center transition-colors border border-black/5 dark:border-white/5 cursor-pointer mr-2"
              aria-label="Toggle Theme"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="text-[12px] font-mono uppercase tracking-wider text-slate-600 dark:text-on-surface-variant hover:text-slate-800 dark:hover:text-on-surface transition-colors flex items-center gap-1.5 bg-transparent border-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Share Survey</span>
            </button>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="flex-grow p-8 max-w-[1280px] mx-auto w-full relative z-10 flex flex-col gap-8">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-6 text-center max-w-[480px] mx-auto">
              <span className="material-symbols-outlined text-[48px] mb-2">error</span>
              <h3 className="font-bold text-[18px] mb-1">Access Denied</h3>
              <p className="text-[14px] text-on-surface-variant mb-4">{error}</p>
              <Link
                to="/dashboard"
                className="inline-block bg-white/10 hover:bg-white/15 px-6 py-2 rounded font-mono text-[12px] uppercase tracking-wider"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* Analytics Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    {survey?.logo_url && (
                      <img src={survey.logo_url} alt="Logo" className="max-h-8 object-contain" />
                    )}
                    <h1 className="font-extrabold text-[32px] tracking-tight text-slate-800 dark:text-on-surface leading-none">
                      {survey?.title}
                    </h1>
                  </div>
                  <p className="text-slate-500 dark:text-on-surface-variant text-[14px]">
                    Detailed analytics dashboard and respondent submission logs.
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {responses.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex-1 sm:flex-initial bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[12px] font-mono uppercase tracking-wider py-2.5 px-5 rounded border border-emerald-500/20 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Export CSV</span>
                    </button>
                  )}
                  <Link
                    to="/surveys/$surveyId/edit"
                    params={{ surveyId }}
                    className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-on-surface text-[12px] font-mono uppercase tracking-wider py-2.5 px-5 rounded border border-slate-200 dark:border-white/5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>Edit Survey</span>
                  </Link>
                </div>
              </div>

              {/* KPI Analytics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Total Responses */}
                <div className="bg-white/80 dark:bg-[#1a1f21]/70 border border-slate-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md shadow-sm dark:shadow-none transition-colors duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 dark:text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Total Submissions
                    </span>
                    <span className="material-symbols-outlined p-2 rounded-lg text-primary-container dark:text-primary bg-primary/10">
                      inbox
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-slate-800 dark:text-on-surface">
                    {stats.totalResponses}
                  </div>
                </div>

                {/* Answer Completion */}
                <div className="bg-white/80 dark:bg-[#1a1f21]/70 border border-slate-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md shadow-sm dark:shadow-none transition-colors duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 dark:text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Answer Completion
                    </span>
                    <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 bg-emerald-400/10 p-2 rounded-lg">
                      donut_large
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-slate-800 dark:text-on-surface">
                    {stats.completionRate}%
                  </div>
                </div>

                {/* Average Rating */}
                <div className="bg-white/80 dark:bg-[#1a1f21]/70 border border-slate-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md shadow-sm dark:shadow-none transition-colors duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-500 dark:text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Average Scale Rating
                    </span>
                    <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 bg-amber-400/10 p-2 rounded-lg">
                      grade
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-slate-800 dark:text-on-surface flex items-baseline gap-1">
                    <span>{stats.averageRating > 0 ? stats.averageRating : 'N/A'}</span>
                    {stats.averageRating > 0 && (
                      <span className="text-[16px] text-slate-400 dark:text-on-surface-variant font-medium">
                        / 5
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submissions Section */}
              <div>
                <h2 className="font-extrabold text-[20px] mb-4 text-slate-800 dark:text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">list_alt</span>
                  <span>Respondent Submissions ({responses.length})</span>
                </h2>

                {responses.length === 0 ? (
                  <div className="bg-white/80 dark:bg-[#1a1f21]/30 border border-slate-200 dark:border-white/5 rounded-xl p-12 text-center flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-[36px] text-slate-400 dark:text-on-surface-variant">
                      chat_bubble_outline
                    </span>
                    <div>
                      <h3 className="font-bold text-[16px] text-slate-800 dark:text-on-surface mb-0.5">
                        No responses yet
                      </h3>
                      <p className="text-slate-500 dark:text-on-surface-variant text-[13px] max-w-[280px]">
                        Share the public link of this survey with respondents to start getting
                        results.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {responses.map((resp, index) => (
                      <div
                        key={resp.id}
                        className="bg-white/80 dark:bg-[#151c26]/40 border border-slate-200 dark:border-white/10 rounded-xl p-6 backdrop-blur-md relative overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300"
                      >
                        <div
                          className="absolute left-0 top-0 h-full w-[4px]"
                          style={{ backgroundColor: brandColor }}
                        />

                        {/* Submission Header info */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-white/5 mb-4">
                          <span className="font-mono text-[12px] uppercase text-slate-500 dark:text-on-surface-variant">
                            Respondent #{responses.length - index}
                          </span>
                          <span className="text-[12px] text-slate-500 dark:text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span>{new Date(resp.created_at).toLocaleString()}</span>
                          </span>
                        </div>

                        {/* Answer Details mapping */}
                        <div className="flex flex-col gap-4">
                          {questions.map((q) => {
                            const ansValue = resp.answers[q.id]
                            const answered = ansValue !== undefined && ansValue !== ''

                            return (
                              <div key={q.id} className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-on-surface-variant">
                                  {q.label}
                                </span>

                                {!answered ? (
                                  <span className="text-[13px] italic text-slate-400 dark:text-white/30">
                                    No response provided
                                  </span>
                                ) : q.type === 'rating' ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map((val) => {
                                        const ratingVal = Number.parseInt(ansValue, 10)
                                        const isActive = ratingVal >= val
                                        return (
                                          <span
                                            key={val}
                                            className="material-symbols-outlined text-[18px]"
                                            style={{
                                              color: isActive
                                                ? '#f59e0b'
                                                : 'rgba(156, 163, 175, 0.3)',
                                              fontVariationSettings: isActive
                                                ? "'FILL' 1"
                                                : "'FILL' 0",
                                            }}
                                          >
                                            star
                                          </span>
                                        )
                                      })}
                                    </div>
                                    <span className="font-mono text-[12px] font-semibold text-slate-800 dark:text-on-surface ml-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                                      {ansValue} / 5
                                    </span>
                                  </div>
                                ) : q.type === 'multiple_choice' ? (
                                  <div className="flex">
                                    <span
                                      className="text-[12px] font-semibold py-1 px-3 rounded-full border flex items-center gap-1.5"
                                      style={{
                                        borderColor: `${brandColor}40`,
                                        backgroundColor: `${brandColor}15`,
                                        color: brandColor,
                                      }}
                                    >
                                      <span
                                        className="material-symbols-outlined text-[14px]"
                                        style={{ color: brandColor }}
                                      >
                                        check
                                      </span>
                                      <span>{ansValue}</span>
                                    </span>
                                  </div>
                                ) : q.type === 'checkbox' ? (
                                  <div className="flex flex-wrap gap-2">
                                    {ansValue.split(', ').map((val) => (
                                      <span
                                        key={val}
                                        className="text-[12px] font-semibold py-1 px-3 rounded-full border flex items-center gap-1.5"
                                        style={{
                                          borderColor: `${brandColor}40`,
                                          backgroundColor: `${brandColor}15`,
                                          color: brandColor,
                                        }}
                                      >
                                        <span
                                          className="material-symbols-outlined text-[14px]"
                                          style={{ color: brandColor }}
                                        >
                                          check_box
                                        </span>
                                        <span>{val}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : q.type === 'number' ? (
                                  <div className="flex">
                                    <span className="text-[13px] font-mono font-semibold py-1.5 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 text-slate-800 dark:text-[#e0e3e5] flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-on-surface-variant">
                                        tag
                                      </span>
                                      <span>{ansValue}</span>
                                    </span>
                                  </div>
                                ) : q.type === 'date_picker' ? (
                                  <div className="flex">
                                    <span className="text-[13px] font-mono font-semibold py-1.5 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 text-slate-800 dark:text-[#e0e3e5] flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-on-surface-variant">
                                        calendar_today
                                      </span>
                                      <span>{ansValue}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[14px] text-slate-800 dark:text-on-surface bg-slate-50 dark:bg-black/15 border border-slate-200 dark:border-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                                    {ansValue}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Share Link Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-[500px] rounded-xl p-6 relative overflow-hidden bg-white dark:bg-[#151c26]/95 border border-slate-200 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            style={{ fontFamily: `'${survey?.font_family || 'Manrope'}', sans-serif` }}
          >
            <div
              className="absolute inset-0 pointer-events-none z-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${brandColor}40 0%, transparent 60%)`,
              }}
            />

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-[20px] text-slate-800 dark:text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ color: brandColor }}>
                    share
                  </span>
                  <span>Share Survey</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-slate-500 dark:text-on-surface-variant hover:text-slate-800 dark:hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <p className="text-[13px] text-slate-500 dark:text-on-surface-variant mb-4">
                Anyone with this link can view and submit responses to your survey.
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/s/${surveyId}`}
                  className="flex-1 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2 text-slate-800 dark:text-on-surface text-[13px] focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2 px-5 font-mono uppercase tracking-wider text-[11px] rounded-lg transition-all font-bold flex items-center gap-1.5 h-[38px]"
                  style={{
                    backgroundColor: copied ? '#10b981' : brandColor,
                    color: '#ffffff',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-on-surface text-[11px] font-mono uppercase tracking-wider py-2 px-4 rounded border border-slate-200 dark:border-white/5 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
