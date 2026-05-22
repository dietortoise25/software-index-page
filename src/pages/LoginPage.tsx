import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signInUsername } from "@/lib/auth-client"
import { useAuth } from "@/lib/auth-context"

const schema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(8, "密码至少 8 位"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refresh, loggedIn, loading } = useAuth()

  // 已登录自动跳转
  useEffect(() => {
    if (!loading && loggedIn) {
      navigate(searchParams.get("redirect") || "/", { replace: true })
    }
  }, [loading, loggedIn])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const result = await signInUsername(data)
      if (result.error) {
        setError("root", { message: result.error.message || "登录失败" })
      } else {
        await refresh()
        navigate(searchParams.get("redirect") || "/internal/admin")
      }
    } catch {
      setError("root", { message: "网络错误" })
    }
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">用户名</label>
            <input
              {...register("username")}
              placeholder="输入用户名"
              autoFocus
              className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
            {errors.username && (
              <p className="mt-1 text-destructive text-xs">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">密码</label>
            <input
              type="password"
              {...register("password")}
              placeholder="输入密码"
              className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
            {errors.password && (
              <p className="mt-1 text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-destructive text-sm text-center">{errors.root.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "登录中..." : "登录"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或</span>
            </div>
          </div>

          <a
            href="/api/auth/feishu/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            飞书账号登录<span className="ml-1 text-xs text-muted-foreground">(仅内部)</span>
          </a>

          <p className="text-center text-xs text-muted-foreground pt-2">
            没有账号？<a href="/register" className="text-primary underline">访客注册</a>
          </p>
        </form>
      </div>
    </div>
  )
}
