import { useCallback, useRef, useState } from "react"
import { Upload, X, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FileEntry {
  file: File
  name: string
  size: string
}

interface Props {
  files: FileEntry[]
  onFilesAdded: (files: File[]) => void
  onRemoveFile: (index: number) => void
  disabled?: boolean
}

export default function FileDropzone({ files, onFilesAdded, onRemoveFile, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"),
      )
      if (dropped.length) onFilesAdded(dropped)
    },
    [disabled, onFilesAdded],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFilesAdded(Array.from(e.target.files))
      e.target.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <Upload className="mx-auto mb-2 text-muted-foreground" size={32} />
        <p className="text-sm text-muted-foreground">
          拖拽多个 Shopee Excel 到此处，或点击选择文件
        </p>
        <p className="text-xs text-muted-foreground mt-1">支持 .xlsx / .xls，多个文件自动合并</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={16} className="text-green-600 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground text-xs shrink-0">{f.size}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }}
                disabled={disabled}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-right">
            共 {files.length} 个文件
          </p>
        </div>
      )}
    </div>
  )
}
