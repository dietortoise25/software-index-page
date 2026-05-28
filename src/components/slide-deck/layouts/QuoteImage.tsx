import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useSlideDeck } from '../SlideDeckContext'
import { easeOutExpo } from '../easing'

interface QuoteImageProps {
  kicker?: string
  title: string
  titleSize?: string
  lead?: string
  callout?: string
  calloutSrc?: string
  image: ReactNode
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
}

export function QuoteImage({
  kicker,
  title,
  titleSize = '7.2vw',
  lead,
  callout,
  calloutSrc,
  image,
}: QuoteImageProps) {
  const { colors } = useSlideDeck()

  return (
    <div className="grid grid-cols-[7fr_5fr] gap-[2vh_3vw]" style={{ paddingTop: '6vh', alignItems: 'start' }}>
      {/* Left column */}
      <div className="flex flex-col justify-between" style={{ gap: '3vh' }}>
        <div>
          {kicker && (
            <motion.div
              className="font-mono text-[10px] tracking-[0.25em] uppercase mb-[2vh]"
              style={{ opacity: 0.4 }}
              variants={item}
            >
              {kicker}
            </motion.div>
          )}
          <motion.h2
            className="font-bold leading-[1.06] -tracking-[0.02em]"
            style={{ fontSize: titleSize, whiteSpace: 'nowrap' }}
            variants={item}
          >
            {title}
          </motion.h2>
          {lead && (
            <motion.p
              className="font-light opacity-70 mt-[3vh]"
              style={{ fontSize: '1.25vw' }}
              variants={item}
            >
              {lead}
            </motion.p>
          )}
        </div>
        {callout && (
          <motion.div variants={item}>
            <div className="text-[1.6vw] leading-relaxed opacity-90 pl-[1.5vw] border-l-[3px]" style={{ borderColor: colors.accent }}>
              {callout}
            </div>
            {calloutSrc && (
              <div className="font-mono text-[10px] tracking-[0.15em] mt-[1vh]" style={{ opacity: 0.45 }}>
                {calloutSrc}
              </div>
            )}
          </motion.div>
        )}
      </div>
      {/* Right column */}
      <motion.div variants={item}>
        {image}
      </motion.div>
    </div>
  )
}
