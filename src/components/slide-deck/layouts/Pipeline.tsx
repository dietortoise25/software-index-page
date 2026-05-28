import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSlideDeck } from '../SlideDeckContext'
import { easeOutExpo } from '../easing'

interface PipelineStep {
  num: string
  title: string
  desc: string
}

interface PipelineSection {
  label: string
  steps: PipelineStep[]
}

interface PipelineProps {
  kicker?: string
  title?: string
  sections: PipelineSection[]
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
}

export function Pipeline({ kicker, title, sections }: PipelineProps) {
  const { colors } = useSlideDeck()
  const [revealed, setRevealed] = useState(0)
  const totalSteps = sections.reduce((sum, s) => sum + s.steps.length, 0)

  const advance = useCallback(() => {
    setRevealed((prev) => Math.min(prev + 1, totalSteps))
  }, [totalSteps])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        if (revealed < totalSteps) {
          e.preventDefault()
          e.stopPropagation()
          advance()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [revealed, totalSteps, advance])

  let stepIndex = 0
  let globalIdx = 0

  return (
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
          className="font-bold leading-[1.2] mb-[2vh]"
          style={{ fontSize: '2.6vw', color: colors.accent }}
          variants={item}
        >
          {title}
        </motion.h2>
      )}
      {sections.map((section, si) => {
        const sectionStart = stepIndex
        return (
          <div key={si} className="mb-[3.6vh]">
            <motion.div
              className="font-mono text-[9px] tracking-[0.15em] uppercase mb-[1.5vh] border-t border-white/10 pt-[1.5vh]"
              style={{ opacity: 0.45 }}
              variants={item}
            >
              {section.label}
            </motion.div>
            <div className="flex gap-[1.5vw] flex-wrap">
              {section.steps.map((step, i) => {
                const isRevealed = globalIdx < revealed
                stepIndex = sectionStart
                globalIdx++

                return (
                  <div
                    key={i}
                    className="flex-1 min-w-[120px] rounded-lg border border-white/6 p-[2vh_1.5vw] transition-all duration-500"
                    style={{
                      background: isRevealed ? 'rgba(255,255,255,0.04)' : 'transparent',
                      opacity: isRevealed ? 1 : 0.15,
                    }}
                  >
                    <div className="font-mono font-semibold text-[14px]" style={{ color: colors.accent }}>
                      {step.num}
                    </div>
                    <div className="font-semibold text-[1vw] mt-[0.5vh]">{step.title}</div>
                    <div className="text-[0.85vw] opacity-65 mt-[0.3vh]">{step.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
