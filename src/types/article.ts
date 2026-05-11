export interface Article {
  id: string
  title: string
  summary: string
  date: string
  author?: string
  tags?: string[]
  content?: string
}
