import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminMe, adminLogout, clearAdminAuthToken, isServerOfflineError } from '../services/api.js'

const AuthContext = createContext(null)
const CACHED_ADMIN_USER_KEY = 'itsgenygarts_admin_user'

function readCachedAdminUser() {
  try {
    const raw = localStorage.getItem(CACHED_ADMIN_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCachedAdminUser(user) {
  try {
    if (user) localStorage.setItem(CACHED_ADMIN_USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(CACHED_ADMIN_USER_KEY)
  } catch {
    // localStorage can be unavailable in private/embedded contexts.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readCachedAdminUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cachedUser = readCachedAdminUser()
    adminMe()
      .then((data) => {
        if (!cancelled) {
          setUser(data)
          writeCachedAdminUser(data)
        }
      })
      .catch((err) => {
        if (!cancelled && isServerOfflineError(err) && cachedUser) {
          setUser(cachedUser)
        } else if (!cancelled) {
          clearAdminAuthToken()
          writeCachedAdminUser(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback((userData) => {
    setUser(userData)
    writeCachedAdminUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminLogout()
    } catch {
      // ignore
    }
    clearAdminAuthToken()
    writeCachedAdminUser(null)
    setUser(null)
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
