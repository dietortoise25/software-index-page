import { useState } from "react"
import { softwareList } from "@/data/software"
import SearchBar from "@/components/software/SearchBar"
import SoftwareGrid from "@/components/software/SoftwareGrid"
import { useSoftwareFilter } from "@/hooks/useSoftwareFilter"
import { SITE_DESCRIPTION } from "@/lib/constants"

export default function HomePage() {
  const [search, setSearch] = useState("")
  const filtered = useSoftwareFilter(softwareList, search)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-3 font-bold text-3xl tracking-tight">软件工具目录</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">{SITE_DESCRIPTION}</p>
      </div>
      <SearchBar value={search} onChange={setSearch} />
      <SoftwareGrid softwareList={filtered} searchQuery={search} />
    </div>
  )
}
