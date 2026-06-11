import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

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
  type: 'short_text' | 'multiple_choice' | 'rating'
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
      <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex flex-col justify-center items-center gap-4">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
          progress_activity
        </span>
        <span className="text-[14px] font-mono uppercase tracking-wider text-on-surface-variant">
          Loading responses analytics...
        </span>
      </div>
    )
  }

  const brandColor = survey?.primary_color || '#3b82f6'

  return (
    <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex font-sans antialiased overflow-x-hidden select-none">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-[#191c1e] border-r border-white/5 flex flex-col p-6 gap-4 z-40 hidden md:flex">
        <div className="mb-10 px-2 mt-4">
          <div className="text-[28px] font-extrabold tracking-tight text-on-surface">DoCoDeGo</div>
          <div className="text-on-surface-variant text-[12px] font-mono uppercase tracking-wider mt-1">
            Survey Dashboard
          </div>
        </div>

        <div className="flex-grow flex flex-col gap-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-on-surface-variant rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </Link>
          <Link
            to="/surveys/$surveyId/edit"
            params={{ surveyId }}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-on-surface-variant rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all"
          >
            <span className="material-symbols-outlined">edit</span>
            <span>Survey Builder</span>
          </Link>
        </div>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-white/5">
          <div className="flex flex-col px-3 py-2">
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
              Signed in as:
            </span>
            <span className="text-[12px] text-on-surface truncate font-medium">
              {auth.user?.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg font-mono uppercase tracking-wider text-[12px] text-left transition-all w-full"
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
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${brandColor}10 0%, #101415 65%)`,
          }}
        />

        {/* Top Header */}
        <header className="sticky top-0 w-full z-30 bg-[#101415]/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center h-16 px-8 relative z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[18px] text-on-surface hidden md:block">
              Results Analytics
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`/s/${surveyId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-mono uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Public Link</span>
            </a>
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
                    <h1 className="font-extrabold text-[32px] tracking-tight text-on-surface leading-none">
                      {survey?.title}
                    </h1>
                  </div>
                  <p className="text-on-surface-variant text-[14px]">
                    Detailed analytics dashboard and respondent submission logs.
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <Link
                    to="/surveys/$surveyId/edit"
                    params={{ surveyId }}
                    className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 text-on-surface text-[12px] font-mono uppercase tracking-wider py-2.5 px-5 rounded border border-white/5 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>Edit Survey</span>
                  </Link>
                </div>
              </div>

              {/* KPI Analytics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Total Responses */}
                <div className="bg-[#1a1f21]/70 border border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Total Submissions
                    </span>
                    <span
                      className="material-symbols-outlined p-2 rounded-lg"
                      style={{ color: brandColor, backgroundColor: `${brandColor}15` }}
                    >
                      inbox
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-on-surface">
                    {stats.totalResponses}
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="bg-[#1a1f21]/70 border border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Answer Completion
                    </span>
                    <span className="material-symbols-outlined text-emerald-400 bg-emerald-400/10 p-2 rounded-lg">
                      donut_large
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-on-surface">
                    {stats.completionRate}%
                  </div>
                </div>

                {/* Average Rating */}
                <div className="bg-[#1a1f21]/70 border border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-on-surface-variant font-mono uppercase tracking-wider text-[11px]">
                      Average Scale Rating
                    </span>
                    <span className="material-symbols-outlined text-amber-400 bg-amber-400/10 p-2 rounded-lg">
                      grade
                    </span>
                  </div>
                  <div className="font-extrabold text-[36px] text-on-surface flex items-baseline gap-1">
                    <span>{stats.averageRating > 0 ? stats.averageRating : 'N/A'}</span>
                    {stats.averageRating > 0 && (
                      <span className="text-[16px] text-on-surface-variant font-medium">/ 5</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submissions Section */}
              <div>
                <h2 className="font-extrabold text-[20px] mb-4 text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">list_alt</span>
                  <span>Respondent Submissions ({responses.length})</span>
                </h2>

                {responses.length === 0 ? (
                  <div className="bg-[#1a1f21]/30 border border-white/5 rounded-xl p-12 text-center flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                      chat_bubble_outline
                    </span>
                    <div>
                      <h3 className="font-bold text-[16px] text-on-surface mb-0.5">
                        No responses yet
                      </h3>
                      <p className="text-on-surface-variant text-[13px] max-w-[280px]">
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
                        className="bg-[#151c26]/40 border border-white/10 rounded-xl p-6 backdrop-blur-md relative overflow-hidden"
                      >
                        <div
                          className="absolute left-0 top-0 h-full w-[4px]"
                          style={{ backgroundColor: brandColor }}
                        />

                        {/* Submission Header info */}
                        <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-4">
                          <span className="font-mono text-[12px] uppercase text-on-surface-variant">
                            Respondent #{responses.length - index}
                          </span>
                          <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
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
                                <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
                                  {q.label}
                                </span>

                                {!answered ? (
                                  <span className="text-[13px] italic text-white/30">
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
                                              color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.1)',
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
                                    <span className="font-mono text-[12px] font-semibold text-on-surface ml-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
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
                                        color: '#ffffff',
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
                                ) : (
                                  <p className="text-[14px] text-on-surface bg-black/15 border border-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
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
    </div>
  )
}
