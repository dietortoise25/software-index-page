import { motion } from 'framer-motion'
import { useSlideDeck } from '../SlideDeckContext'
import { easeOutExpo } from '../easing'

interface StatItem {
  label: string
  value: string
  unit?: string
  note?: string
}

interface BigNumbersProps {
  kicker?: string
  title?: string
  lead?: string
  stats: StatItem[]
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
}

export function BigNumbers({ kicker, title, lead, stats }: BigNumbersProps) {
  const { colors } = useSlideDeck()

  return (
    <div style={{ paddingTop: '6vh' }}>
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
          className="font-bold leading-[1.2] mb-[2vh]"
          style={{ fontSize: '2.6vw', color: colors.accent }}
          variants={item}
        >
          {title}
        </motion.h2>
      )}
      {lead && (
        <motion.p
          className="font-light opacity-70 mb-[5vh]"
          style={{ fontSize: '1.25vw' }}
          variants={item}
        >
          {lead}
        </motion.p>
      )}
      <motion.div
        className="grid grid-cols-3 gap-[1.8vh_2vw]"
        style={{ marginTop: '6vh' }}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.075 } },
        }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            className="rounded-lg border border-white/6 p-[2.5vh_2vw]"
            style={{ background: 'rgba(255,255,255,0.04)' }}
            variants={item}
          >
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase" style={{ opacity: 0.4 }}>
              {s.label}
            </div>
            <div className="font-black leading-none my-[0.5vh]" style={{ fontSize: '4vw', color: colors.accent }}>
              {s.value}
              {s.unit && (
                <span style={{ fontSize: '0.4em', opacity: 0.5, fontStyle: 'normal' }}> {s.unit}</span>
              )}
            </div>
            {s.note && (
              <div className="text-[0.85vw] opacity-65 leading-relaxed">{s.note}</div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
