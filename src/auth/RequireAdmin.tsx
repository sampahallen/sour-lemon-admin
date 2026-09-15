import { Navigate, Outlet } from 'react-router'
import { useAuth } from './authContext'

export function RequireAdmin() {
  const { session } = useAuth()

  if (!session) return <Navigate to="/signin" replace />

  return <Outlet />
}
