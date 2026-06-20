// ==============================================================================
// CLIENT-SIDE REACT ENTRY POINT (main.tsx)
// ==============================================================================
// This is the bootstrap script for the frontend single page application.
// It initializes the TanStack Router, binds type declarations to the router register,
// mounts the AuthProvider/ThemeProvider context wrappers, and renders the Root component
// into the HTML `#root` element.
// ==============================================================================

import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { routeTree } from './routeTree.gen'
import './index.css'

// Create TanStack Router instance using generated route config tree.
// The auth context is left undefined during scaffold and injected at mount.
const router = createRouter({
  routeTree,
  context: {
    auth: undefined as unknown as ReturnType<typeof useAuth>,
  },
})

// Register the router instance type for type-safe navigations.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Find React container element.
const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element missing')

/**
 * App Component - Injects the active Auth Context into the Router Context Provider.
 * Displays a global loading verification spinner while resolving stateless JWT sessions.
 */
function App() {
  const auth = useAuth()

  // Display a verification loader until session response is fetched from /api/auth/me.
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-on-surface">
        <div className="flex flex-col items-center gap-md">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
            progress_activity
          </span>
          <span className="text-body-md font-mono">Verifying credentials...</span>
        </div>
      </div>
    )
  }

  // Inject active auth methods into TanStack router context to guard routes.
  return <RouterProvider router={router} context={{ auth }} />
}

// Render React node.
createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
