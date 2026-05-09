import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorkbenchLinkProps {
  url: string
}

export default function WorkbenchLink({ url }: WorkbenchLinkProps) {
  return (
    <Button
      variant="outline"
      render={
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
          打开 Web 工作台
        </a>
      }
    />
  )
}
