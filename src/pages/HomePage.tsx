import { useState } from "react"
import { useNavigate } from "react-router"
import { Lock, Unlock } from "lucide-react"
import { softwareList } from "@/data/software"
import SearchBar from "@/components/software/SearchBar"
import SoftwareGrid from "@/components/software/SoftwareGrid"
import { useSoftwareFilter } from "@/hooks/useSoftwareFilter"
import { Button } from "@/components/ui/button"
import { SITE_DESCRIPTION } from "@/lib/constants"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const [search, setSearch] = useState("")
  const { loggedIn } = useAuth()
  const navigate = useNavigate()

  const visibleList = loggedIn ? softwareList : softwareList.filter((s) => !s.requirePin)
  const filtered = useSoftwareFilter(visibleList, search)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-3 font-bold text-3xl tracking-tight">软件工具目录</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">{SITE_DESCRIPTION}</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        <SearchBar value={search} onChange={setSearch} />
        <Button
          variant={loggedIn ? "default" : "ghost"}
          size="icon"
          onClick={() => loggedIn ? navigate(0) : navigate("/login?redirect=/catalog")}
          aria-label={loggedIn ? "已解锁" : "登录解锁更多工具"}
        >
          {loggedIn ? <Unlock className="size-4" /> : <Lock className="size-4" />}
        </Button>
      </div>

      <SoftwareGrid softwareList={filtered} searchQuery={search} />
    </div>
  )
}
