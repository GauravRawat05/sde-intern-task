// ==============================================================================
// USER AUTHENTICATION PROVIDER (auth.tsx)
// ==============================================================================
// This file implements stateless session tracking and client-side authentication.
// It leverages a React Context (`AuthContext`) to expose the active user object, 
// loading status, and fetch wrappers for registration (`signup`), login (`login`), 
// and session destruction (`logout`) requests to the Hono API backend.
// ==============================================================================

import { createContext, useContext, useEffect, useState } from 'react'

/**
 * User interface defining the structure of an authenticated user session.
 */
export interface User {
  id: string
  email: string
}

/**
 * Interface defining the API methods and states exposed by the Auth Hook.
 */
interface AuthContextType {
  user: User | null
  loading: boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; code?: string; error?: string }>
  signup: (
    email: string,
    password: string,
    captchaAnswer: string,
    captchaToken: string,
  ) => Promise<{ success: boolean; code?: string; error?: string }>
  logout: () => Promise<void>
}

// Instantiate React Context holding the session status.
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider component that wraps the React application tree,
 * synchronizes session cookies with the backend, and manages login/signup state.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Verify session on application mount.
  // This contacts '/api/auth/me' which validates the stateless session JWT stored in secure HTTP-Only cookies.
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = (await response.json()) as { user: User }
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to verify session:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  /**
   * login - Authenticates user credentials via POST request to '/api/auth/login'.
   * Sets the user context on success and returns status codes or error messages on failure.
   */
  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = (await response.json()) as {
        user?: User
        error?: string
        code?: string
      }

      if (response.ok && data.user) {
        setUser(data.user)
        return { success: true }
      }

      return {
        success: false,
        code: data.code,
        error: data.error || 'Authentication failed',
      }
    } catch (error) {
      console.error('Login request failed:', error)
      return { success: false, error: 'Network error during login' }
    }
  }

  /**
   * signup - Registers a new user via POST request to '/api/auth/signup'.
   * Requires the solved math CAPTCHA answer and captchaToken for bot prevention.
   */
  const signup = async (
    email: string,
    password: string,
    captchaAnswer: string,
    captchaToken: string,
  ): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaAnswer, captchaToken }),
      })

      const data = (await response.json()) as {
        user?: User
        error?: string
        code?: string
      }

      if (response.ok && data.user) {
        setUser(data.user)
        return { success: true }
      }

      return {
        success: false,
        code: data.code,
        error: data.error || 'Registration failed',
      }
    } catch (error) {
      console.error('Signup request failed:', error)
      return { success: false, error: 'Network error during sign up' }
    }
  }

  /**
   * logout - Destroys session by requesting '/api/auth/logout' which deletes backend cookies,
   * then resets the local react user context state.
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth - Custom hook to access Auth Context states (user, loading, login, signup, logout)
 * anywhere in the React tree. Throws if used outside AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
