import { motion } from 'framer-motion'
import { easeOutExpo } from '../easing'

interface ComparisonColumn {
  kicker: string
  title: string
  items: string[]
}

interface ComparisonProps {
  kicker?: string
  title?: string
  before: ComparisonColumn
  after: ComparisonColumn
}

export function Comparison({ kicker, title, before, after }: ComparisonProps) {
  return (
    <div style={{ paddingTop: '5vh' }}>
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
          className="font-bold leading-[1.2] mb-[4vh]"
          style={{ fontSize: '2.6vw' }}
          variants={item}
        >
          {title}
        </motion.h2>
      )}
      <div className="grid grid-cols-2 gap-[5vw_4vh]">
        {/* Before */}
        <motion.div
          className="p-[3vh_2vw] border-l-[3px]"
          style={{ opacity: 0.55 }}
          variants={left}
        >
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-[2vh]" style={{ opacity: 0.9 }}>
            {before.kicker}
          </div>
          <h3 className="font-semibold leading-[1.3] mt-[2vh]" style={{ fontSize: '1.6vw' }}>
            {before.title}
          </h3>
          <ul
            className="mt-[3vh] pl-[1.2em] flex flex-col leading-[1.55]"
            style={{ gap: '1.4vh', fontSize: 'max(14px, 1.1vw)' }}
          >
            {before.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </motion.div>
        {/* After */}
        <motion.div
          className="p-[3vh_2vw] border-l-[3px]"
          variants={right}
        >
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-[2vh]" style={{ opacity: 0.9 }}>
            {after.kicker}
          </div>
          <h3 className="font-semibold leading-[1.3] mt-[2vh]" style={{ fontSize: '1.6vw' }}>
            {after.title}
          </h3>
          <ul
            className="mt-[3vh] pl-[1.2em] flex flex-col leading-[1.55]"
            style={{ gap: '1.4vh', fontSize: 'max(14px, 1.1vw)' }}
          >
            {after.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  )
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOutExpo } },
}

const left = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 0.55, x: 0, transition: { duration: 0.6, ease: easeOutExpo, delay: 0.3 } },
}

const right = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: easeOutExpo, delay: 0.5 } },
}
