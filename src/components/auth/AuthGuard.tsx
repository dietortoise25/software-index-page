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

  // 访客 JWT token 验证
  const token = searchParams.get("token")
  useEffect(() => {
    if (loggedIn || !token) { setVisitorChecked(true); return }
    // 简单 JWT 解码验证（不验签名，仅检查过期）
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      if (payload.pagePath && payload.exp && Date.now() < payload.exp * 1000) {
        // 检查 token 是否匹配当前路径
        if (location.pathname.startsWith(payload.pagePath)) {
          setVisitorChecked(true)
          return
        }
      }
    } catch { /* invalid token */ }
    setVisitorChecked(true)
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
