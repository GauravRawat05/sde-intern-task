// ==============================================================================
// USER ACCESS & AUTHENTICATION SCREEN (login.tsx)
// ==============================================================================
// This route component implements the Sign In, Sign Up, and Forgot Password views.
// It manages input validations, tab states, math CAPTCHA fetching/validation,
// and redirects authenticated users to the `/dashboard`.
// ==============================================================================

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

// Register the `/login` route with TanStack Router
export const Route = createFileRoute('/login')({
  component: Login,
})

// Sub-tabs representing different authentication forms
type Tab = 'signin' | 'signup' | 'forgot'

/**
 * Login Component - Houses forms for Sign In, Sign Up, and Password Reset.
 * Integrates math captcha verification statelessly to prevent bot attacks.
 */
function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // Tab selector state
  const [tab, setTab] = useState<Tab>('signin')
  
  // Input fields state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // Stateless Captcha verification parameters
  const [captchaEquation, setCaptchaEquation] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  // UX Feedback states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Auth Redirect Guard: Immediately route authenticated users to the dashboard.
  useEffect(() => {
    if (auth.user) {
      navigate({ to: '/dashboard' })
    }
  }, [auth.user, navigate])

  /**
   * fetchCaptcha - Contacts the backend /api/auth/captcha endpoint to retrieve 
   * a fresh equation challenge and its signed validation token.
   */
  const fetchCaptcha = useCallback(async () => {
    try {
      setCaptchaAnswer('')
      const res = await fetch('/api/auth/captcha')
      if (res.ok) {
        const data = (await res.json()) as {
          equation: string
          captchaToken: string
        }
        setCaptchaEquation(data.equation)
        setCaptchaToken(data.captchaToken)
      }
    } catch (err) {
      console.error('Failed to load CAPTCHA:', err)
      setError('Failed to load CAPTCHA. Please refresh.')
    }
  }, [])

  // Sync effect: Automatically loads a CAPTCHA challenge when switching to sign up or forgot tabs,
  // and resets error/success banners to keep form transitions clean.
  useEffect(() => {
    if (tab === 'signup' || tab === 'forgot') {
      fetchCaptcha()
    }
    // Reset fields on tab change
    setError('')
    setSuccessMsg('')
    setPassword('')
    setConfirmPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setCaptchaAnswer('')
  }, [tab, fetchCaptcha])

  /**
   * handleSignIn - Triggers credentials authentication logic.
   * Redirects user to sign up automatically if email record is not found.
   */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError('')
    setSuccessMsg('')

    const result = await auth.login(email, password)
    setLoading(true) // Keep loader visible during transition

    if (result.success) {
      setSuccessMsg('Authenticated successfully!')
      setTimeout(() => {
        setLoading(false)
        navigate({ to: '/dashboard' })
      }, 800)
    } else {
      setLoading(false)
      if (result.code === 'NEW_USER') {
        // Automatically pivot to registration if user profile doesn't exist
        setError('No account found with this email. Redirecting to Sign Up...')
        setTimeout(() => {
          setTab('signup')
          setError('Please sign up to create a new account.')
        }, 2000)
      } else {
        setError(result.error || 'Invalid credentials')
      }
    }
  }

  /**
   * handleSignUp - Submits registration payload including math captcha answers.
   * Redirects user to login tab automatically if account already exists.
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !confirmPassword || !captchaAnswer) return

    // Pre-submission input validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')

    const result = await auth.signup(email, password, captchaAnswer, captchaToken)
    setLoading(true)

    if (result.success) {
      setSuccessMsg('Account created successfully!')
      setTimeout(() => {
        setLoading(false)
        navigate({ to: '/dashboard' })
      }, 800)
    } else {
      setLoading(false)
      if (result.code === 'EXISTING_USER') {
        // Automatically pivot to login if account is already configured
        setError('An account with this email already exists. Redirecting to Sign In...')
        setTimeout(() => {
          setTab('signin')
          setError('Existing account found. Please sign in with your credentials.')
        }, 2000)
      } else {
        setError(result.error || 'Sign up failed')
        fetchCaptcha() // Refresh CAPTCHA so user can retry immediately
      }
    }
  }

  /**
   * handleResetPassword - Submits a password update request enclosing captcha verifications.
   */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !newPassword || !confirmNewPassword || !captchaAnswer) return

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          captchaAnswer,
          captchaToken,
          newPassword,
        }),
      })

      const data = (await res.json()) as { error?: string }
      setLoading(false)

      if (res.ok) {
        setSuccessMsg('Password updated successfully! Redirecting to Sign In...')
        setTimeout(() => {
          setTab('signin')
        }, 2000)
      } else {
        setError(data.error || 'Password reset failed')
        fetchCaptcha()
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
      setError('Network error during password reset.')
      fetchCaptcha()
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
      <main className="flex-grow flex items-center justify-center p-6 relative z-10 my-4">
        <div
          className="w-full max-w-[440px] rounded-xl p-8 relative overflow-hidden transition-all duration-300 bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
          style={{
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Subtle Inner Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

          {/* Logo & Visual Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-surface-variant/30 flex items-center justify-center mb-3 border border-slate-200 dark:border-outline/20">
              <span
                className="material-symbols-outlined text-[28px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {tab === 'signin' ? 'vpn_key' : tab === 'signup' ? 'person_add' : 'lock_reset'}
              </span>
            </div>
            <h1 className="text-[26px] font-extrabold mb-1 tracking-tight text-slate-800 dark:text-on-surface">
              {tab === 'signin'
                ? 'Sign In'
                : tab === 'signup'
                  ? 'Create Account'
                  : 'Reset Password'}
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-on-surface-variant max-w-[320px]">
              {tab === 'signin'
                ? 'Enter your credentials to access your workspace.'
                : tab === 'signup'
                  ? 'Register a new account and solve the math CAPTCHA.'
                  : 'Enter your email and solve the CAPTCHA to set a new password.'}
            </p>
          </div>

          {/* Form Tabs Selector */}
          <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-lg mb-6 border border-slate-200/50 dark:border-white/5">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`flex-1 py-1.5 rounded-md text-[12px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                tab === 'signin'
                  ? 'bg-white dark:bg-[#1a1f21] text-slate-800 dark:text-on-surface shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-on-surface-variant hover:text-slate-700 dark:hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`flex-1 py-1.5 rounded-md text-[12px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                tab === 'signup'
                  ? 'bg-white dark:bg-[#1a1f21] text-slate-800 dark:text-on-surface shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-on-surface-variant hover:text-slate-700 dark:hover:text-on-surface'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setTab('forgot')}
              className={`flex-1 py-1.5 rounded-md text-[12px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                tab === 'forgot'
                  ? 'bg-white dark:bg-[#1a1f21] text-slate-800 dark:text-on-surface shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-on-surface-variant hover:text-slate-700 dark:hover:text-on-surface'
              }`}
            >
              Forgot
            </button>
          </div>

          {/* Form Render Block */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-[13px] flex items-start gap-2 mb-4 leading-relaxed">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-[13px] flex items-start gap-2 mb-4 leading-relaxed">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                check_circle
              </span>
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'signin' && (
            <form className="flex flex-col gap-4.5" onSubmit={handleSignIn}>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="email"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    mail
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                className={`w-full text-[#002e6a] rounded-lg py-2.5 px-4 font-mono tracking-wider uppercase text-[12px] transition-all relative overflow-hidden group flex justify-center items-center h-[42px] mt-2 cursor-pointer ${
                  loading
                    ? 'bg-primary/60 cursor-not-allowed opacity-80'
                    : 'bg-primary hover:bg-[#9cbbf2] shadow-[0_0_20px_rgba(173,198,255,0.2)]'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Authenticate</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                      arrow_forward
                    </span>
                  </span>
                )}
              </button>
            </form>
          )}

          {tab === 'signup' && (
            <form className="flex flex-col gap-4.5" onSubmit={handleSignUp}>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="signup-email"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    mail
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="signup-password"
                >
                  Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="signup-confirm"
                >
                  Confirm Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="signup-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>

              {/* Captcha Verification challenge */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center px-1">
                  <label
                    className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant"
                    htmlFor="signup-captcha"
                  >
                    Solve CAPTCHA:{' '}
                    <strong className="text-primary font-bold">{captchaEquation}</strong>
                  </label>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    className="text-[9px] font-mono uppercase tracking-wider text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[10px]">refresh</span>
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    calculate
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="signup-captcha"
                    type="text"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Your answer"
                    required
                  />
                </div>
              </div>

              <button
                className={`w-full text-[#002e6a] rounded-lg py-2.5 px-4 font-mono tracking-wider uppercase text-[12px] transition-all relative overflow-hidden group flex justify-center items-center h-[42px] mt-2 cursor-pointer ${
                  loading
                    ? 'bg-primary/60 cursor-not-allowed opacity-80'
                    : 'bg-primary hover:bg-[#9cbbf2] shadow-[0_0_20px_rgba(173,198,255,0.2)]'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Create Account</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                      how_to_reg
                    </span>
                  </span>
                )}
              </button>
            </form>
          )}

          {tab === 'forgot' && (
            <form className="flex flex-col gap-4.5" onSubmit={handleResetPassword}>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="forgot-email"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    mail
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="forgot-new"
                >
                  New Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="forgot-new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant ml-1"
                  htmlFor="forgot-confirm"
                >
                  Confirm New Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    lock
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="forgot-confirm"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              {/* Captcha Verification challenge */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center px-1">
                  <label
                    className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-on-surface-variant"
                    htmlFor="forgot-captcha"
                  >
                    Solve CAPTCHA:{' '}
                    <strong className="text-primary font-bold">{captchaEquation}</strong>
                  </label>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    className="text-[9px] font-mono uppercase tracking-wider text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[10px]">refresh</span>
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline group-focus-within:text-primary transition-colors text-[18px]">
                    calculate
                  </span>
                  <input
                    className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-outline/30 rounded-lg py-2 pl-[40px] pr-4 text-slate-800 dark:text-on-surface placeholder:text-slate-400 dark:placeholder:text-outline-variant focus:outline-none focus:border-primary transition-all text-[14px]"
                    id="forgot-captcha"
                    type="text"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Your answer"
                    required
                  />
                </div>
              </div>

              <button
                className={`w-full text-[#002e6a] rounded-lg py-2.5 px-4 font-mono tracking-wider uppercase text-[12px] transition-all relative overflow-hidden group flex justify-center items-center h-[42px] mt-2 cursor-pointer ${
                  loading
                    ? 'bg-primary/60 cursor-not-allowed opacity-80'
                    : 'bg-primary hover:bg-[#9cbbf2] shadow-[0_0_20px_rgba(173,198,255,0.2)]'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Reset Password</span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                      published_with_changes
                    </span>
                  </span>
                )}
              </button>
            </form>
          )}
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
