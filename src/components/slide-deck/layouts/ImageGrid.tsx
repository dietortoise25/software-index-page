import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { easeOutExpo } from '../easing'

interface ImageGridProps {
  kicker?: string
  title?: string
  images: { node: ReactNode; caption?: string; sub?: string }[]
  cols?: 2 | 3
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
}

export function ImageGrid({ kicker, title, images, cols = 3 }: ImageGridProps) {
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
          className="font-bold leading-[1.2] mb-[2vh]"
          style={{ fontSize: '2.6vw' }}
          variants={item}
        >
          {title}
        </motion.h2>
      )}
      <motion.div
        className="grid gap-[1.8vh_2vw]"
        style={{
          gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
          marginTop: '4vh',
        }}
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.075 } },
        }}
      >
        {images.map((img, i) => (
          <motion.div key={i} variants={item}>
            <div style={{ height: '26vh' }} className="overflow-hidden rounded-lg">
              {img.node}
            </div>
            {img.caption && (
              <div className="flex justify-between items-center mt-[1vh]">
                <span className="font-mono text-[9px] tracking-[0.1em] opacity-50">{img.caption}</span>
                {img.sub && (
                  <span className="font-mono text-[9px] tracking-[0.1em] opacity-50">{img.sub}</span>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
