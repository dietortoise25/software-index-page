import { motion } from 'framer-motion'
import { easeOutExpo } from '../easing'

interface ActDividerProps {
  kicker?: string
  act: string
  title: string
  lead?: string
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeOutExpo },
  },
}

export function ActDivider({ kicker, act, title, lead }: ActDividerProps) {
  return (
    <div className="flex-1 flex flex-col justify-center" style={{ gap: '6vh', minHeight: '80vh' }}>
      <motion.div
        className="font-mono text-[10px] tracking-[0.25em] uppercase"
        style={{ opacity: 0.4 }}
        variants={item}
      >
        {kicker ?? act}
      </motion.div>
      <motion.h1
        className="font-extrabold leading-[1.06] -tracking-[0.02em]"
        style={{ fontSize: '8.5vw' }}
        variants={item}
      >
        {title}
      </motion.h1>
      {lead && (
        <motion.p
          className="font-light opacity-70 max-w-[55vw]"
          style={{ fontSize: '1.6vw' }}
          variants={item}
        >
          {lead}
        </motion.p>
      )}
    </div>
  )
}
