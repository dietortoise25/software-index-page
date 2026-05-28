import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SlideDeckContextType, DeckStyle } from './types'
import type { MagazineTheme, SwissTheme } from './types'
import { getThemeColors } from './themes'

const SlideDeckContext = createContext<SlideDeckContextType | null>(null)

export function useSlideDeck() {
  const ctx = useContext(SlideDeckContext)
  if (!ctx) throw new Error('useSlideDeck must be used within <SlideDeck>')
  return ctx
}

export function SlideDeckProvider({
  children,
  totalSlides,
  style = 'magazine',
  theme = 'ink-classic',
}: {
  children: ReactNode
  totalSlides: number
  style?: DeckStyle
  theme?: MagazineTheme | SwissTheme
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goTo = useCallback(
    (i: number) => {
      if (i >= 0 && i < totalSlides) setCurrentIndex(i)
    },
    [totalSlides],
  )

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo])
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo])

  const colors = useMemo(() => getThemeColors(style, theme), [style, theme])

  const value = useMemo(
    () => ({ currentIndex, totalSlides, goTo, goNext, goPrev, deckStyle: style, colors }),
    [currentIndex, totalSlides, goTo, goNext, goPrev, style, colors],
  )

  return (
    <SlideDeckContext.Provider value={value}>
      {children}
    </SlideDeckContext.Provider>
  )
}
