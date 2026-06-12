import { createContext, useContext, useEffect, useState } from 'react'

export interface User {
  id: string
  email: string
}

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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Verify session on application mount
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
