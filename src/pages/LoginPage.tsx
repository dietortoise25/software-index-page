import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/auth-client"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn.email({
        email: username,
        password,
        callbackURL: searchParams.get("redirect") || "/internal/admin",
      })

      if (result.error) {
        setError(result.error.message || "登录失败")
      } else {
        const redirect = searchParams.get("redirect") || "/internal/admin"
        navigate(redirect)
      }
    } catch {
      setError("网络错误")
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <LogIn className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">管理者登录</h1>
          <p className="text-muted-foreground text-sm mt-1">杠杆工坊</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              autoFocus
              className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!username || !password || loading}
          >
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
      </div>
    </div>
  )
}
