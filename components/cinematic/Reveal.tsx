'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  )
}
