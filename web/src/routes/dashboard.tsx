import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: Dashboard,
})

interface Survey {
  id: string
  title: string
  primary_color: string
  logo_url: string
  font_family?: string
  created_at: string
  response_count?: number
}

function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShareSurvey, setActiveShareSurvey] = useState<Survey | null>(null)
  const [copied, setCopied] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    async function loadSurveys() {
      try {
        const response = await fetch('/api/surveys')
        if (response.ok) {
          const data = (await response.json()) as { surveys: Survey[] }
          setSurveys(data.surveys || [])
        }
      } catch (error) {
        console.error('Failed to load surveys:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSurveys()
  }, [])

  const handleLogout = async () => {
    await auth.logout()
    navigate({ to: '/login' })
  }

  const handleCreateSurvey = async () => {
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Survey',
          primary_color: '#3b82f6',
          logo_url: '',
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as { survey: Survey }
        navigate({ to: `/surveys/${data.survey.id}/edit` })
      }
    } catch (error) {
      console.error('Failed to create survey:', error)
    }
  }

  // Calculate stats
  const totalResponses = surveys.reduce((acc, s) => acc + (s.response_count || 0), 0)
  const activeCount = surveys.length

  return (
    <div className="bg-[#f8fafc] dark:bg-[#101415] text-[#1e293b] dark:text-[#e0e3e5] min-h-screen flex font-sans antialiased overflow-x-hidden relative select-none transition-colors duration-300">
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

        <button
          type="button"
          onClick={handleCreateSurvey}
          className="w-full bg-primary hover:bg-primary/90 text-[#002e6a] font-mono uppercase tracking-wider text-[12px] py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all mb-6 shadow-[0_0_20px_rgba(173,198,255,0.2)]"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add
          </span>
          Create New
        </button>

        <div className="flex-grow flex flex-col gap-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 bg-slate-100 dark:bg-primary-container text-slate-800 dark:text-on-primary-container rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all border border-slate-200 dark:border-transparent"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
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

      {/* Main Content Area */}
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 w-full z-30 bg-white/85 dark:bg-[#101415]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/5 flex justify-between items-center h-16 px-8 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[18px] text-slate-800 dark:text-on-surface hidden md:block">
              DoCoDeGo Builder
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 dark:text-on-surface-variant text-[12px] font-mono hidden sm:block">
              {auth.user?.email}
            </span>

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

            <button
              type="button"
              onClick={handleLogout}
              className="text-[12px] font-mono uppercase tracking-wider text-primary hover:text-primary-container transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="flex-grow p-8 max-w-[1280px] mx-auto w-full">
          {/* Dashboard Title */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
            <div>
              <h1 className="font-extrabold text-[36px] tracking-tight text-slate-800 dark:text-on-surface">
                My Surveys
              </h1>
              <p className="text-slate-500 dark:text-on-surface-variant text-[14px]">
                Create and manage your branded surveys and view responses.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateSurvey}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-[#002e6a] font-mono uppercase tracking-wider text-[12px] py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(173,198,255,0.2)]"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                add
              </span>
              New Survey
            </button>
          </div>

          {/* KPI Analytics Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
            <div className="bg-white/80 dark:bg-[#1a1f21] border border-slate-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 dark:text-on-surface-variant font-mono uppercase tracking-wider text-[12px]">
                  Total Responses Received
                </span>
                <span className="material-symbols-outlined text-primary-container dark:text-primary bg-primary/10 p-2 rounded-lg">
                  groups
                </span>
              </div>
              <div className="font-extrabold text-[40px] text-slate-800 dark:text-on-surface">
                {totalResponses}
              </div>
            </div>

            <div className="bg-white/80 dark:bg-[#1a1f21] border border-slate-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 dark:text-on-surface-variant font-mono uppercase tracking-wider text-[12px]">
                  Total Surveys Created
                </span>
                <span className="material-symbols-outlined text-tertiary-container dark:text-tertiary bg-tertiary/10 p-2 rounded-lg">
                  poll
                </span>
              </div>
              <div className="font-extrabold text-[40px] text-slate-800 dark:text-on-surface">
                {activeCount}
              </div>
            </div>
          </div>

          {/* Survey List / Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
                progress_activity
              </span>
              <span className="text-on-surface-variant text-[14px] font-mono">
                Loading your surveys...
              </span>
            </div>
          ) : surveys.length === 0 ? (
            <div className="bg-[#adc6ff]/10 dark:bg-[#1a1f21] border border-primary/20 dark:border-white/5 rounded-xl p-10 flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 dark:bg-surface-variant/30 flex items-center justify-center border border-primary/30 dark:border-outline/15">
                <span className="material-symbols-outlined text-[32px] text-primary-container dark:text-on-surface-variant">
                  description
                </span>
              </div>
              <div>
                <h3 className="font-bold text-[18px] text-slate-800 dark:text-on-surface mb-1">
                  No surveys yet
                </h3>
                <p className="text-slate-500 dark:text-on-surface-variant text-[14px] max-w-[320px] mx-auto">
                  Create your first customized branded survey to start gathering insights.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateSurvey}
                className="bg-primary hover:bg-primary/90 text-[#002e6a] font-mono uppercase tracking-wider text-[12px] py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(173,198,255,0.2)]"
              >
                Create Your First Survey
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="bg-white dark:bg-[#1a1f21] border border-slate-200 dark:border-white/5 rounded-xl p-6 flex flex-col group hover:border-primary/50 transition-colors duration-300 relative overflow-hidden shadow-sm dark:shadow-none"
                >
                  <div
                    className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none opacity-20"
                    style={{ backgroundColor: survey.primary_color || '#3b82f6' }}
                  />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/25 shadow-md"
                        style={{ backgroundColor: survey.primary_color || '#3b82f6' }}
                      />
                      <span className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-md uppercase">
                        Survey
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-[20px] text-slate-800 dark:text-on-surface mb-2 leading-tight group-hover:text-primary transition-colors">
                    {survey.title}
                  </h3>
                  <p className="text-slate-500 dark:text-on-surface-variant text-[12px] mb-6 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-slate-700 dark:text-on-surface text-[14px] font-semibold">
                        {survey.response_count || 0} Responses
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/surveys/$surveyId/edit"
                        params={{ surveyId: survey.id }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-on-surface text-[12px] font-mono uppercase tracking-wider py-2 rounded flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-white/5"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                      </Link>
                      <Link
                        to="/surveys/$surveyId/responses"
                        params={{ surveyId: survey.id }}
                        className="flex-1 bg-[#adc6ff] hover:bg-[#9cbbf2] dark:bg-surface-container-high dark:hover:bg-surface-bright text-[#002e6a] dark:text-on-surface text-[12px] font-mono uppercase tracking-wider py-2 rounded flex items-center justify-center gap-1.5 transition-colors border border-blue-200/50 dark:border-none shadow-sm dark:shadow-none"
                      >
                        <span className="material-symbols-outlined text-[16px]">bar_chart</span>{' '}
                        Results
                      </Link>
                      <button
                        type="button"
                        onClick={() => setActiveShareSurvey(survey)}
                        className="w-10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-on-surface py-2 rounded flex items-center justify-center transition-colors border border-slate-200 dark:border-white/5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">share</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Share Link Modal */}
      {activeShareSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-[500px] rounded-xl p-6 relative overflow-hidden bg-[#151c26]/95 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
            style={{ fontFamily: `'${activeShareSurvey.font_family || 'Manrope'}', sans-serif` }}
          >
            <div
              className="absolute inset-0 pointer-events-none z-0 opacity-20"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${activeShareSurvey.primary_color || '#3b82f6'}40 0%, transparent 60%)`,
              }}
            />

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-[20px] text-on-surface flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: activeShareSurvey.primary_color || '#3b82f6' }}
                  >
                    share
                  </span>
                  <span>Share Survey</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveShareSurvey(null)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <p className="text-[13px] text-on-surface-variant mb-4">
                Anyone with this link can view and submit responses to your survey.
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/s/${activeShareSurvey.id}`}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3.5 py-2 text-on-surface text-[13px] focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/s/${activeShareSurvey.id}`
                    navigator.clipboard.writeText(shareUrl)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="py-2 px-5 font-mono uppercase tracking-wider text-[11px] rounded-lg transition-all font-bold flex items-center gap-1.5 h-[38px]"
                  style={{
                    backgroundColor: copied
                      ? '#10b981'
                      : activeShareSurvey.primary_color || '#3b82f6',
                    color: '#002e6a',
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
                  onClick={() => setActiveShareSurvey(null)}
                  className="bg-white/5 hover:bg-white/10 text-on-surface text-[11px] font-mono uppercase tracking-wider py-2 px-4 rounded border border-white/5 transition-colors"
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
