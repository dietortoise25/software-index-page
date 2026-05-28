import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlideDeckProvider, useSlideDeck } from './SlideDeckContext'
import type { SlideDeckProps, DeckStyle } from './types'
import type { MagazineTheme, SwissTheme } from './types'
import { SlideNav } from './SlideNav'
import { WebGLBackground } from './backgrounds/WebGLBackground'

function DeckInner({ slides, showNav = true }: { slides: ReactNode[]; showNav?: boolean }) {
  const { currentIndex, goNext, goPrev, deckStyle, colors } = useSlideDeck()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      if (Math.abs(e.deltaY) < 20) return
      e.deltaY > 0 ? goNext() : goPrev()
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => el.removeEventListener('wheel', onWheel)
  }, [goNext, goPrev])

  let tx = 0
  useEffect(() => {
    const onStart = (e: TouchEvent) => { tx = e.touches[0].clientX }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - tx
      if (Math.abs(dx) > 50) dx > 0 ? goPrev() : goNext()
    }
    window.addEventListener('touchstart', onStart)
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [goNext, goPrev])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{ background: deckStyle === 'magazine' ? colors.ink : colors.paper }}
    >
      <WebGLBackground style={deckStyle} colors={colors} currentIndex={currentIndex} />

      <AnimatePresence>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{ zIndex: 10 }}
        >
          {slides[currentIndex]}
        </motion.div>
      </AnimatePresence>

      {showNav && <SlideNav />}
    </div>
  )
}

export function SlideDeck({
  children,
  style = 'magazine',
  theme = 'ink-classic',
  showNav = true,
}: SlideDeckProps) {
  const slides = Array.isArray(children) ? children : [children]
  const totalSlides = slides.length

  return (
    <SlideDeckProvider
      totalSlides={totalSlides}
      style={style as DeckStyle}
      theme={theme as MagazineTheme | SwissTheme}
    >
      <DeckInner showNav={showNav} slides={slides}>
      </DeckInner>
    </SlideDeckProvider>
  )
}

export { Slide } from './Slide'
export { SlideNav } from './SlideNav'
export { useSlideDeck } from './SlideDeckContext'
