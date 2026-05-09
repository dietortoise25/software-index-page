import type { Software } from "@/types/software"
import SoftwareCard from "./SoftwareCard"
import EmptyState from "@/components/common/EmptyState"

interface SoftwareGridProps {
  softwareList: Software[]
  searchQuery?: string
}

export default function SoftwareGrid({ softwareList, searchQuery }: SoftwareGridProps) {
  if (softwareList.length === 0) {
    return (
      <EmptyState
        title={searchQuery ? `未找到与 "${searchQuery}" 相关的软件` : "暂无软件"}
        description={searchQuery ? "试试其他关键词" : "请检查数据配置"}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {softwareList.map((sw) => (
        <SoftwareCard key={sw.id} software={sw} />
      ))}
    </div>
  )
}
