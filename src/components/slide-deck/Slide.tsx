import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { SlideProps } from './types'
import { useSlideDeck } from './SlideDeckContext'
import { easeOutExpo } from './easing'

export function Slide({
  children,
  kind = 'light',
  chromeLeft,
  chromeRight,
  footLeft,
  footRight,
}: SlideProps) {
  const { colors, currentIndex, totalSlides } = useSlideDeck()
  const slideRef = useRef<HTMLDivElement>(null)

  const isDark = kind === 'dark' || kind === 'hero-dark'
  const isHero = kind === 'hero-dark' || kind === 'hero-light'

  const bg = isDark ? colors.ink : colors.paper
  const fg = isDark ? colors.paper : colors.ink

  const staggerChildren = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: isHero ? 0.16 : 0.075,
        delayChildren: 0.3,
      },
    },
  }

  return (
    <div
      ref={slideRef}
      className="w-full h-full flex flex-col relative overflow-y-auto"
      style={{
        background: bg,
        color: fg,
        padding: '7vh 7vw 10vh 7vw',
      }}
    >
      {/* Chrome header */}
      {(chromeLeft || chromeRight) && (
        <div
          className="flex justify-between items-start font-mono text-[10px] tracking-[0.2em] uppercase shrink-0 mb-[5vh]"
          style={{ opacity: 0.45 }}
        >
          <span>{chromeLeft ?? ''}</span>
          <span>{chromeRight ?? `${currentIndex + 1} / ${totalSlides}`}</span>
        </div>
      )}

      {/* Main content with stagger animation */}
      <motion.div
        className="flex-1 flex flex-col justify-center"
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>

      {/* Foot */}
      {(footLeft || footRight) && (
        <div
          className="flex justify-between items-end font-mono text-[10px] shrink-0 mt-auto"
          style={{ opacity: 0.35 }}
        >
          <span>{footLeft ?? ''}</span>
          <span>{footRight ?? '— · —'}</span>
        </div>
      )}
    </div>
  )
}

export { AnimatedItem, AnimatedLine, AnimatedLeft, AnimatedRight }
export type { AnimatedItemProps, AnimatedLineProps }

interface AnimatedItemProps {
  children: React.ReactNode
  className?: string
  delay?: number
}
function AnimatedItem({ children, className, delay = 0 }: AnimatedItemProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: easeOutExpo, delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedLineProps {
  children: React.ReactNode
  className?: string
  delay?: number
}
function AnimatedLine({ children, className, delay = 0 }: AnimatedLineProps) {
  return (
    <motion.span
      className={className}
      style={{ display: 'block' }}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: easeOutExpo, delay },
        },
      }}
    >
      {children}
    </motion.span>
  )
}

function AnimatedLeft({
  children,
  className,
  delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, x: -40 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.6, ease: easeOutExpo, delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRight({
  children,
  className,
  delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, x: 40 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.6, ease: easeOutExpo, delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
