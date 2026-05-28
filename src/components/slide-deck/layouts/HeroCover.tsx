import { motion } from 'framer-motion'
import { useSlideDeck } from '../SlideDeckContext'
import { easeOutExpo } from '../easing'

interface HeroCoverProps {
  kicker?: string
  title: string
  titleAccent?: string
  subtitle?: string
  lead?: string
  meta?: string
  stats?: { value: string; label: string }[]
}

export function HeroCover({ kicker, title, titleAccent, subtitle, lead, meta, stats }: HeroCoverProps) {
  const { colors } = useSlideDeck()

  return (
    <motion.div
      className="flex-1 flex flex-col justify-center"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
      }}
    >
      {kicker && (
        <motion.div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-[2vh]"
          style={{ opacity: 0.4 }}
          variants={item}
        >
          {kicker}
        </motion.div>
      )}
      <motion.h1
        className="font-extrabold leading-[1.06] -tracking-[0.02em] mb-[2.5vh]"
        style={{ fontSize: '5vw' }}
        variants={item}
      >
        {title}
        {titleAccent && (
          <span style={{ color: colors.accent }}> {titleAccent}</span>
        )}
      </motion.h1>
      {subtitle && (
        <motion.p
          className="font-light opacity-70 mb-[2vh] max-w-[75%] leading-relaxed"
          style={{ fontSize: '1.6vw' }}
          variants={item}
        >
          {subtitle}
        </motion.p>
      )}
      {lead && (
        <motion.p
          className="font-light opacity-70 mb-[6vh] max-w-[75%] leading-relaxed"
          style={{ fontSize: '1.6vw' }}
          variants={item}
        >
          {lead}
        </motion.p>
      )}
      {meta && (
        <motion.div className="font-mono text-[10px] tracking-[0.2em] mb-[2vh]" style={{ opacity: 0.45 }} variants={item}>
          {meta}
        </motion.div>
      )}
      {stats && (
        <motion.div className="flex gap-[3vw]" style={{ opacity: 0.5 }} variants={item}>
          {stats.map((s, i) => (
            <div key={i}>
              <span style={{ color: colors.accent, fontWeight: 700, fontSize: '2vw' }}>{s.value}</span>
              <br />
              <span style={{ fontSize: '0.8vw' }}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOutExpo } },
}
