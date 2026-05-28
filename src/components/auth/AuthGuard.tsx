import { useEffect, useState, type ReactNode } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router"
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
  const [searchParams] = useSearchParams()
  const [visitorChecked, setVisitorChecked] = useState(false)

  // 访客 JWT token 验证 — 服务端验签
  const token = searchParams.get("token")
  useEffect(() => {
    if (loggedIn || !token) { setVisitorChecked(true); return }
    fetch("/api/auth/verify-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid && d.pagePath && location.pathname.startsWith(d.pagePath)) {
          setVisitorChecked(true)
          return
        }
        setVisitorChecked(true)
      })
      .catch(() => setVisitorChecked(true))
  }, [token, loggedIn])

  useEffect(() => {
    if (!loading && !loggedIn && visitorChecked) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?redirect=${redirect}`, { replace: true })
    }
  }, [loading, loggedIn, visitorChecked])

  if (loading || !visitorChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!loggedIn && !token) return null

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
