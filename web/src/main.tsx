import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: {
    auth: undefined as unknown as ReturnType<typeof useAuth>,
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element missing')

function App() {
  const auth = useAuth()

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

  return <RouterProvider router={router} context={{ auth }} />
}

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
