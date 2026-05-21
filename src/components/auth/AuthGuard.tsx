import { useEffect, type ReactNode } from "react"
import { useNavigate, useLocation } from "react-router"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface Props {
  children: ReactNode
  requireAdmin?: boolean
}

export default function AuthGuard({ children, requireAdmin: _requireAdmin }: Props) {
  const { loggedIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !loggedIn) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${redirect}`, { replace: true })
    }
  }, [loading, loggedIn])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!loggedIn) return null

  return <>{children}</>
}
