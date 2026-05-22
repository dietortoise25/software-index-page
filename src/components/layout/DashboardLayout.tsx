import { Outlet, Link, useLocation } from "react-router"
import { BarChart3, Users, Shield, ArrowLeftRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const SIDEBAR_ITEMS = [
  { to: "/dashboard", label: "运营看板", icon: BarChart3, end: true },
  { to: "/dashboard/admin", label: "分组管理", icon: Users, admin: true },
  { to: "/dashboard/permission", label: "权限管理", icon: Shield, admin: true },
  { to: "/return-workflow", label: "审批流程", icon: ArrowLeftRight, external: true },
]

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* 侧边栏 */}
      <aside className="w-48 shrink-0 border-r bg-background p-3 hidden sm:block">
        <nav className="flex flex-col gap-0.5">
          {SIDEBAR_ITEMS.filter((item) => !item.admin || isAdmin).map((item) => {
            const active = item.end
              ? pathname === item.to
              : pathname.startsWith(item.to) && !item.end
            return (
              <Link key={item.to} to={item.to} className={linkClass(active)}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* 移动端底部 tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background flex items-center justify-around py-1">
        {SIDEBAR_ITEMS.filter((item) => !item.admin || isAdmin).map((item) => {
          const active = item.end
            ? pathname === item.to
            : pathname.startsWith(item.to) && !item.end
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 pb-14 sm:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
