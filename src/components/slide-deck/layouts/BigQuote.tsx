import { motion } from 'framer-motion'
import { easeOutExpo } from '../easing'

interface BigQuoteProps {
  kicker?: string
  quoteLines: string[]
  translation?: string
  source?: string
}

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
}

export function BigQuote({ kicker, quoteLines, translation, source }: BigQuoteProps) {
  return (
    <div className="flex-1 flex flex-col justify-center" style={{ gap: '5vh', minHeight: '80vh' }}>
      {kicker && (
        <motion.div
          className="font-mono text-[10px] tracking-[0.25em] uppercase"
          style={{ opacity: 0.4 }}
          variants={item}
        >
          {kicker}
        </motion.div>
      )}
      <motion.blockquote
        className="font-bold leading-[1.2] -tracking-[0.01em] max-w-[72vw] border-none p-0 m-0"
        style={{ fontSize: '5.8vw', fontFamily: 'var(--font-serif, "Noto Serif SC", serif)' }}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.55, delayChildren: 0.3 } },
        }}
      >
        {quoteLines.map((line, i) => (
          <motion.span key={i} style={{ display: 'block' }} variants={item}>
            {line}
          </motion.span>
        ))}
      </motion.blockquote>
      {translation && (
        <motion.p
          className="font-light max-w-[55vw] leading-relaxed"
          style={{ fontSize: '1.25vw', opacity: 0.65 }}
          variants={item}
        >
          {translation}
        </motion.p>
      )}
      {source && (
        <motion.div
          className="font-mono text-[10px] tracking-[0.2em]"
          style={{ opacity: 0.4 }}
          variants={item}
        >
          {source}
        </motion.div>
      )}
    </div>
  )
}
