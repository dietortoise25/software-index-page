export type Platform = "windows" | "macos" | "linux" | "web"

export interface SoftwareVersion {
  version: string
  releaseDate: string
  changelog: string[]
  downloads?: Partial<Record<Platform, string>>
  workbenchUrl?: string
  isLatest?: boolean
}

export interface Software {
  id: string
  name: string
  description: string
  iconName: string
  category: string
  versions: SoftwareVersion[]
  homepageUrl?: string
}
