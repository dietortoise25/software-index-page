import { useNavigate, useSearchParams } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signInUsername } from "@/lib/auth-client"

const schema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(8, "密码至少 8 位"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

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
        </form>
      </div>
    </div>
  )
}
