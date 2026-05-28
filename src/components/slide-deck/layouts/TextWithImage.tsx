import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useSlideDeck } from '../SlideDeckContext'
import { easeOutExpo } from '../easing'

interface TextWithImageProps {
  kicker?: string
  title?: string
  lead?: string
  paragraphs?: string[]
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

export function TextWithImage({
  kicker,
  title,
  lead,
  paragraphs,
  callout,
  calloutSrc,
  image,
}: TextWithImageProps) {
  const { colors } = useSlideDeck()

  return (
    <div className="grid grid-cols-[8fr_4fr] gap-[2vh_3vw]" style={{ paddingTop: '6vh', alignItems: 'start' }}>
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
        {title && (
          <motion.h2
            className="font-bold leading-[1.2] mt-[1vh] mb-[3vh]"
            style={{ fontSize: '2.6vw', color: colors.accent }}
            variants={item}
          >
            {title}
          </motion.h2>
        )}
        {lead && (
          <motion.p
            className="font-light opacity-70 mb-[3vh] leading-relaxed"
            style={{ fontSize: '1.25vw' }}
            variants={item}
          >
            {lead}
          </motion.p>
        )}
        {paragraphs?.map((p, i) => (
          <motion.p
            key={i}
            className="leading-[1.75] mb-[2.4vh]"
            style={{ fontSize: 'max(14px, 1.15vw)', opacity: 0.78 }}
            variants={item}
          >
            {p}
          </motion.p>
        ))}
        {callout && (
          <motion.div
            className="mt-[3vh] text-[1.1vw] leading-relaxed opacity-90 pl-[1.5vw] border-l-[3px]"
            style={{ borderColor: colors.accent }}
            variants={item}
          >
            {callout}
            {calloutSrc && (
              <div className="font-mono text-[10px] tracking-[0.15em] mt-[1vh]" style={{ opacity: 0.45 }}>
                {calloutSrc}
              </div>
            )}
          </motion.div>
        )}
      </div>
      <motion.div variants={item}>{image}</motion.div>
    </div>
  )
}
