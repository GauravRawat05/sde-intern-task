// ==============================================================================
// APPLICATION VISUAL THEME CONTEXT PROVIDER (theme.tsx)
// ==============================================================================
// This file manages the dark/light mode toggle for the survey builder app.
// It persists the chosen theme in the browser's local storage and dynamically 
// adds/removes the `dark` class from the html element to trigger CSS selectors.
// ==============================================================================

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

/**
 * Interface defining the API exposed by the Theme context.
 */
interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

// Create theme context.
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * ThemeProvider component that binds state to html class attributes
 * and exposes theme parameters globally to the client tree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Default to 'dark' mode unless 'theme' value already exists in localStorage.
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  // Synchronize CSS class configurations on theme state change.
  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  /**
   * toggleTheme - Switches context state between light and dark modes.
   */
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

/**
 * useTheme - Hook to read theme state and toggle themes within child components.
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
