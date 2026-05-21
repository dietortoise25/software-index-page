import { useEffect, type ReactNode } from "react"
import { useNavigate, useLocation } from "react-router"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface Props {
  children: ReactNode
  requireAdmin?: boolean
}

export default function AuthGuard({ children, requireAdmin }: Props) {
  const { loggedIn, loading, user } = useAuth()
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

  if (requireAdmin && user?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-1">权限不足</p>
          <p className="text-muted-foreground text-sm">需要管理员权限</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
