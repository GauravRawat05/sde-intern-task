import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { User } from '../lib/auth'

interface RouterContext {
  auth: {
    user: User | null
    loading: boolean
    logout: () => Promise<void>
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
})
