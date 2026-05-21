import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getSession, signOut } from "@/lib/auth-client"

interface AuthState {
  loggedIn: boolean
  user: { id: string; name?: string; email?: string; username?: string } | null
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  loggedIn: false,
  user: null,
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null)

  const refresh = async () => {
    const r = await getSession()
    setUser(r.data?.user ?? null)
  }

  useEffect(() => { refresh() }, [])

  const logout = async () => {
    await signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ loggedIn: !!user, user, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
