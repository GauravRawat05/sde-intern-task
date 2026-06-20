// ==============================================================================
// TANSTACK ROUTER ROOT ROUTE TEMPLATE (__root.tsx)
// ==============================================================================
// This file acts as the global layout wrapper for the routing tree.
// It defines the TS Interface for context dependencies (like authentication)
// that are injected dynamically by the root RouterProvider.
// ==============================================================================

import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { User } from '../lib/auth'

/**
 * Interface defining context dependencies injected into router hooks.
 * Used principally to enforce authentication guards on private routes.
 */
interface RouterContext {
  auth: {
    user: User | null
    loading: boolean
    logout: () => Promise<void>
  }
}

// Create the Root Route layout utilizing RouterContext types.
export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
})
