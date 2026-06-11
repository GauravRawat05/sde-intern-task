import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

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
  created_at: string
  response_count?: number
}

function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

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
    <div className="bg-[#101415] text-[#e0e3e5] min-h-screen flex font-sans antialiased overflow-x-hidden select-none">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-[280px] bg-[#191c1e] border-r border-white/5 flex flex-col p-6 gap-4 z-40 hidden md:flex">
        <div className="mb-10 px-2 mt-4">
          <div className="text-[28px] font-extrabold tracking-tight text-on-surface">DoCoDeGo</div>
          <div className="text-on-surface-variant text-[12px] font-mono uppercase tracking-wider mt-1">
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
            className="flex items-center gap-3 px-3 py-2.5 bg-primary-container text-on-primary-container rounded-lg font-mono uppercase tracking-wider text-[12px] transition-all"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
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

      {/* Main Content Area */}
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 w-full z-30 bg-[#101415]/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center h-16 px-8">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[18px] text-on-surface hidden md:block">
              DoCoDeGo Builder
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-on-surface-variant text-[12px] font-mono hidden sm:block">
              {auth.user?.email}
            </span>
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
              <h1 className="font-extrabold text-[36px] tracking-tight text-on-surface">
                My Surveys
              </h1>
              <p className="text-on-surface-variant text-[14px]">
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
            <div className="bg-[#1a1f21] border border-white/10 rounded-xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-on-surface-variant font-mono uppercase tracking-wider text-[12px]">
                  Total Responses Received
                </span>
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                  groups
                </span>
              </div>
              <div className="font-extrabold text-[40px] text-on-surface">{totalResponses}</div>
            </div>

            <div className="bg-[#1a1f21] border border-white/10 rounded-xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-on-surface-variant font-mono uppercase tracking-wider text-[12px]">
                  Total Surveys Created
                </span>
                <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-2 rounded-lg">
                  poll
                </span>
              </div>
              <div className="font-extrabold text-[40px] text-on-surface">{activeCount}</div>
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
            <div className="bg-[#1a1f21] border border-white/5 rounded-xl p-10 flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-surface-variant/30 flex items-center justify-center border border-outline/15">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                  description
                </span>
              </div>
              <div>
                <h3 className="font-bold text-[18px] text-on-surface mb-1">No surveys yet</h3>
                <p className="text-on-surface-variant text-[14px] max-w-[320px] mx-auto">
                  Create your first customized branded survey to start gathering insights.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateSurvey}
                className="bg-primary hover:bg-primary/90 text-[#002e6a] font-mono uppercase tracking-wider text-[12px] py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                Create Your First Survey
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="bg-[#1a1f21] border border-white/5 rounded-xl p-6 flex flex-col group hover:border-primary/50 transition-colors duration-300 relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none opacity-20"
                    style={{ backgroundColor: survey.primary_color || '#3b82f6' }}
                  />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md"
                        style={{ backgroundColor: survey.primary_color || '#3b82f6' }}
                      />
                      <span className="bg-white/5 border border-white/10 text-on-surface-variant text-[10px] font-mono px-2 py-0.5 rounded-md uppercase">
                        Survey
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-[20px] text-on-surface mb-2 leading-tight group-hover:text-primary transition-colors">
                    {survey.title}
                  </h3>
                  <p className="text-on-surface-variant text-[12px] mb-6 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                  </p>

                  <div className="mt-auto pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-on-surface text-[14px] font-semibold">
                        {survey.response_count || 0} Responses
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/surveys/$surveyId/edit"
                        params={{ surveyId: survey.id }}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-on-surface text-[12px] font-mono uppercase tracking-wider py-2 rounded flex items-center justify-center gap-1.5 transition-colors border border-white/5"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                      </Link>
                      <Link
                        to="/surveys/$surveyId/responses"
                        params={{ surveyId: survey.id }}
                        className="flex-1 bg-surface-container-high hover:bg-surface-bright text-on-surface text-[12px] font-mono uppercase tracking-wider py-2 rounded flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">bar_chart</span>{' '}
                        Results
                      </Link>
                      <a
                        href={`/s/${survey.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-10 bg-white/5 hover:bg-white/10 text-on-surface py-2 rounded flex items-center justify-center transition-colors border border-white/5"
                      >
                        <span className="material-symbols-outlined text-[16px]">share</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
