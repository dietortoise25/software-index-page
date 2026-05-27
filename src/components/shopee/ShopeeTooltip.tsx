import { Info } from "lucide-react"

interface Props {
  content: string
  size?: number
}

export default function ShopeeTooltip({ content, size = 3.5 }: Props) {
  return (
    <span className="relative inline-flex items-center cursor-help group">
      <Info
        className="text-muted-foreground/50 hover:text-primary transition flex-shrink-0"
        style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-64 p-2.5 bg-foreground text-background text-xs rounded-lg shadow-lg leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition pointer-events-none">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </span>
    </span>
  )
}
