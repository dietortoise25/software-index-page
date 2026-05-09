import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative mx-auto mb-8 max-w-md">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="搜索软件名称、描述或分类..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}
