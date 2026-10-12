import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useLocation, useNavigate } from "react-router-dom"

import {
  api,
  clearSessionTokens,
  getRefreshToken,
  getDevelopmentUser,
  isBackendConfigured,
  saveSessionTokens,
  saveDevelopmentUser,
  type ApiUser,
  type PortalRole,
} from "../api/apiClient"

interface SessionContextValue {
  user: ApiUser | null

  loading: boolean

  signIn: (
    email: string,
    password: string,
    portal: PortalRole,
  ) => Promise<ApiUser>

  signOut: () => Promise<void>

  refresh: () => Promise<ApiUser | null>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)

  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isBackendConfigured()) {
      setUser(getDevelopmentUser())

      setLoading(false)

      return getDevelopmentUser()
    }

    if (!getRefreshToken()) {
      setLoading(false)

      return null
    }

    try {
      let response: { user: ApiUser }
      try {
        response = await api.auth.me()
      } catch {
        const refreshed = await api.auth.refresh(getRefreshToken()!)
        saveSessionTokens(refreshed.token, refreshed.refreshToken)
        response = await api.auth.me()
      }

      setUser(response.user)

      return response.user
    } catch {
      clearSessionTokens()

      setUser(null)

      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    async (email: string, password: string, portal: PortalRole) => {
      const response = await api.auth.login(email, password, portal)

      saveSessionTokens(response.token, response.refreshToken)

      saveDevelopmentUser(response.user)

      setUser(response.user)

      return response.user
    },
    [],
  )

  const signOut = useCallback(async () => {
    try {
      if (getRefreshToken()) await api.auth.logout()
    } finally {
      clearSessionTokens()

      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refresh }),
    [loading, refresh, signIn, signOut, user],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) throw new Error("useSession must be used within SessionProvider")

  return value
}

export function RequireRole({
  role,
  children,
}: {
  role: PortalRole
  children: React.ReactNode
}) {
  const { user, loading } = useSession()

  const location = useLocation()

  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && (!user || user.role !== role)) {
      navigate(`/${role}/login`, {
        replace: true,
        state: { from: location.pathname },
      })
    }
  }, [loading, location.pathname, navigate, role, user])

  if (loading || !user || user.role !== role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Checking your session...
      </div>
    )
  }

  return <>{children}</>
}
