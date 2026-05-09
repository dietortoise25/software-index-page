import { SearchX } from "lucide-react"
import type { ReactNode } from "react"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
}

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-muted-foreground/60">
        {icon ?? <SearchX className="size-12" />}
      </div>
      <p className="font-medium text-lg">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">{description}</p>
      )}
    </div>
  )
}
