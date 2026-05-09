import { Download } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SoftwareVersion } from "@/types/software"

interface DownloadButtonProps {
  downloads: SoftwareVersion["downloads"]
  version: string
}

const platformLabel: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  web: "Web",
}

export default function DownloadButton({ downloads, version }: DownloadButtonProps) {
  if (!downloads) return null

  const entries = Object.entries(downloads)

  if (entries.length === 1) {
    const [platform, url] = entries[0]
    return (
      <Button
        render={
          <a href={url} download>
            <Download className="size-4" />
            {platformLabel[platform] ?? platform}
          </a>
        }
      />
    )
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Download className="size-4" />
        下载 v{version}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择下载平台 — v{version}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {entries.map(([platform, url]) => (
            <a
              key={platform}
              href={url}
              download
              className={cn(buttonVariants({ variant: "outline" }), "justify-start")}
            >
              {platformLabel[platform] ?? platform}
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
