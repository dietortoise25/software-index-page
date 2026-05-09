import { useMemo } from "react"
import type { Software } from "@/types/software"

export function useSoftwareFilter(
  softwareList: Software[],
  searchQuery: string,
): Software[] {
  return useMemo(() => {
    if (!searchQuery.trim()) return softwareList
    const q = searchQuery.toLowerCase()
    return softwareList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    )
  }, [softwareList, searchQuery])
}
