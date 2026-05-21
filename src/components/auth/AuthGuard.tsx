import { useEffect, useState, type ReactNode } from "react"
import { useNavigate, useLocation } from "react-router"
import { Loader2 } from "lucide-react"
import { getSession } from "@/lib/auth-client"

interface Props {
  children: ReactNode
  /** 保留用于未来角色检查，当前未实现 */
  requireAdmin?: boolean
}

export default function AuthGuard({ children, requireAdmin: _requireAdmin }: Props) {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getSession()
      .then((result) => {
        if (result.data?.session) {
          setAuthenticated(true)
        } else {
          setAuthenticated(false)
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!checking && !authenticated) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${redirect}`, { replace: true })
    }
  }, [checking, authenticated])

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authenticated) return null

  return <>{children}</>
}
