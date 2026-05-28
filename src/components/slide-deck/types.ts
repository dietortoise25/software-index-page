import type { ReactNode } from 'react'

export type SlideKind = 'hero-dark' | 'hero-light' | 'dark' | 'light'

export type MagazineTheme =
  | 'ink-classic'
  | 'indigo-porcelain'
  | 'forest-ink'
  | 'kraft-paper'
  | 'dune'

export type SwissTheme = 'ikb' | 'lemon-yellow' | 'lemon-green' | 'safety-orange'

export type DeckStyle = 'magazine' | 'swiss'

export interface ThemeColors {
  ink: string
  'ink-rgb': string
  paper: string
  'paper-rgb': string
  'paper-tint': string
  'ink-tint': string
  accent: string
  'accent-rgb': string
}

export interface SlideDeckProps {
  children: ReactNode
  style?: DeckStyle
  theme?: MagazineTheme | SwissTheme
  showNav?: boolean
}

export interface SlideProps {
  children: ReactNode
  kind?: SlideKind
  chromeLeft?: string
  chromeRight?: string
  footLeft?: string
  footRight?: string
}

export interface SlideDeckContextType {
  currentIndex: number
  totalSlides: number
  goTo: (index: number) => void
  goNext: () => void
  goPrev: () => void
  deckStyle: DeckStyle
  colors: ThemeColors
}
