import { motion } from 'framer-motion'
import { easeOutExpo } from '../easing'

interface HeroQuestionProps {
  kicker?: string
  titleLines: string[]
  lead?: string
}

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOutExpo },
  },
}

export function HeroQuestion({ kicker, titleLines, lead }: HeroQuestionProps) {
  return (
    <div className="flex-1 flex flex-col justify-center" style={{ gap: '8vh', minHeight: '80vh' }}>
      {kicker && (
        <motion.div
          className="font-mono text-[10px] tracking-[0.25em] uppercase"
          style={{ opacity: 0.4 }}
          variants={item}
        >
          {kicker}
        </motion.div>
      )}
      <motion.h1
        className="font-extrabold leading-[1.15] -tracking-[0.02em]"
        style={{ fontSize: '7vw' }}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.25, delayChildren: 0.4 } },
        }}
      >
        {titleLines.map((line, i) => (
          <motion.span key={i} style={{ display: 'block' }} variants={item}>
            {line}
          </motion.span>
        ))}
      </motion.h1>
      {lead && (
        <motion.p
          className="font-light opacity-70 max-w-[50vw]"
          style={{ fontSize: '1.6vw' }}
          variants={item}
        >
          {lead}
        </motion.p>
      )}
    </div>
  )
}
