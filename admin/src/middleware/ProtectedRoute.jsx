import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, ready } = useAuth()
  if (!ready) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}
