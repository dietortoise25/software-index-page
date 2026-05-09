import type { Software } from "@/types/software"

export const softwareList: Software[] = [
  {
    id: "tf-service",
    name: "TF客服值守",
    description: "自动客服值守工具，智能应答与工单处理",
    iconName: "Terminal",
    category: "效率工具",
    versions: [
      {
        version: "0.1.2",
        releaseDate: "2026-05-09",
        isLatest: true,
        changelog: [
          "首个发布版本",
          "支持自动客服应答",
          "智能工单处理功能",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF-Service-0.1.2.zip",
        },
      },
    ],
  },
]
