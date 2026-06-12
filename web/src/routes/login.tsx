import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const { theme, toggleTheme } = useTheme()

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (auth.user) {
      navigate({ to: '/dashboard' })
    }
  }, [auth.user, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')
    setSuccessMsg('')

    const success = await auth.login(email)
    setLoading(false)

    if (success) {
      setSuccessMsg('Authenticated successfully!')
      // Wait briefly for success animation/feedback before navigating
      setTimeout(() => {
        navigate({ to: '/dashboard' })
      }, 1000)
    } else {
      setError('Authentication failed. Please verify your email.')
    }
  }

  return (
    <div className="bg-[#f8fafc] dark:bg-[#101415] text-[#1e293b] dark:text-[#e0e3e5] min-h-screen flex flex-col font-sans overflow-x-hidden relative select-none">
      {/* Ambient Radial Gradient Background */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-500"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(circle at 50% 0%, #1a2b6a 0%, #101415 60%)'
              : 'radial-gradient(circle at 50% 0%, #adc6ff40 0%, #f8fafc 60%)',
        }}
      />

      {/* Header */}
      <header className="w-full bg-transparent sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-[1280px] mx-auto">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
            <span className="text-[20px] font-bold tracking-tight text-slate-800 dark:text-on-surface">
              DoCoDeGo Auth
            </span>
          </div>

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
      </header>

      {/* Main Form Area */}
      <main className="flex-grow flex items-center justify-center p-6 relative z-10">
        <div
          className="w-full max-w-[420px] rounded-xl p-8 relative overflow-hidden transition-all duration-300 bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
          style={{
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Subtle Inner Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-surface-variant/30 flex items-center justify-center mb-4 border border-slate-200 dark:border-outline/20">
              <span
                className="material-symbols-outlined text-[32px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                fingerprint
              </span>
            </div>
            <h1 className="text-[28px] font-extrabold mb-2 tracking-tight text-slate-800 dark:text-on-surface">
              Sign in
            </h1>
            <p className="text-[14px] text-slate-500 dark:text-on-surface-variant max-w-[280px]">
              Enter your email to receive a secure login link or sign in.
            </p>
          </div>

          <form className="flex flex-col gap-6" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label
                className="text-[12px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                htmlFor="email"
              >
                Email address
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors">
                  mail
                </span>
                <input
                  className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2.5 pl-[44px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-[14px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-[14px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{successMsg}</span>
              </div>
            )}

            <button
              className={`w-full text-on-primary rounded-lg py-3 px-4 font-mono tracking-wider uppercase text-[12px] transition-all duration-300 relative overflow-hidden group flex justify-center items-center h-[48px] ${
                loading
                  ? 'bg-primary-container cursor-not-allowed opacity-80'
                  : 'bg-primary hover:bg-primary-container shadow-[0_0_20px_rgba(173,198,255,0.2)]'
              }`}
              id="submitBtn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  <span>Send Magic Link</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </span>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-transparent mt-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-6 max-w-[1280px] mx-auto gap-4">
          <span className="text-[12px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant">
            © 2026 DoCoDeGo Security.
          </span>
          <nav className="flex gap-6">
            <a
              className="text-[12px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant hover:text-primary transition-colors"
              href="/privacy"
            >
              Privacy Policy
            </a>
            <a
              className="text-[12px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant hover:text-primary transition-colors"
              href="/terms"
            >
              Terms of Service
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
