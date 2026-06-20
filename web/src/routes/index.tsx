// ==============================================================================
// APP LANDING / ROOT REDIRECT ROUTE (index.tsx)
// ==============================================================================
// This file intercepts navigation attempts to the root URL path ('/').
// It acts as an authentication gatekeeper, redirecting logged-in users 
// to `/dashboard` and guest users to `/login`.
// ==============================================================================

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  // beforeLoad is checked before the component mounts.
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      // Redirect logged-in users to dashboard.
      throw redirect({ to: '/dashboard' })
    } else {
      // Redirect guest users to login screen.
      throw redirect({ to: '/login' })
    }
  },
  component: () => null, // Component is empty since route always triggers a redirect
})
