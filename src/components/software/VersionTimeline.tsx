import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SoftwareVersion } from "@/types/software"
import DownloadButton from "./DownloadButton"
import WorkbenchLink from "./WorkbenchLink"

interface VersionTimelineProps {
  versions: SoftwareVersion[]
}

export default function VersionTimeline({ versions }: VersionTimelineProps) {
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">版本号</TableHead>
            <TableHead className="w-28">发布日期</TableHead>
            <TableHead>更新日志</TableHead>
            <TableHead className="w-40">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => (
            <TableRow key={v.version}>
              <TableCell className="font-mono font-medium">
                v{v.version}
                {v.isLatest && (
                  <Badge variant="secondary" className="ml-2">
                    Latest
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {v.releaseDate}
              </TableCell>
              <TableCell>
                <ul className="space-y-1">
                  {v.changelog.map((item, j) => (
                    <li key={j} className="text-sm before:mr-2 before:content-['•']">
                      {item}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1.5">
                  <DownloadButton downloads={v.downloads} version={v.version} />
                  {v.workbenchUrl && <WorkbenchLink url={v.workbenchUrl} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
