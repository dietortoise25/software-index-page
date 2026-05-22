import { useState } from "react"
import { useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signInUsername } from "@/lib/auth-client"
import { useAuth } from "@/lib/auth-context"

const schema = z.object({
  username: z.string().min(2, "用户名至少 2 位"),
  password: z.string().min(8, "密码至少 8 位"),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${data.username}@visitor.user`, password: data.password, name: data.username, username: data.username }),
        credentials: "include",
      })
      const json = await res.json()
      if (res.ok) {
        // 自动登录
        await signInUsername({ username: data.username, password: data.password })
        await refresh()
        setSuccess(true)
        setTimeout(() => navigate("/catalog"), 1500)
      } else {
        setError("root", { message: json.message || "注册失败，用户名可能已被占用" })
      }
    } catch {
      setError("root", { message: "网络错误" })
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <UserPlus className="size-6 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold">注册成功</h1>
          <p className="text-muted-foreground text-sm mt-1">正在跳转...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <UserPlus className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">访客注册</h1>
          <p className="text-muted-foreground text-sm mt-1">创建账号以访问更多功能</p>
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
            {errors.username && <p className="mt-1 text-destructive text-xs">{errors.username.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">密码</label>
            <input
              type="password"
              {...register("password")}
              placeholder="至少 8 位"
              className="w-full rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
            {errors.password && <p className="mt-1 text-destructive text-xs">{errors.password.message}</p>}
          </div>
          {errors.root && <p className="text-destructive text-sm text-center">{errors.root.message}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "注册中..." : "注册"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            已有账号？<a href="/login" className="text-primary underline">登录</a>
          </p>
        </form>
      </div>
    </div>
  )
}
