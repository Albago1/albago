'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export function SectionLabel({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={cn(
        'flex items-center gap-3',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      <span className="h-px w-8 bg-flame-500" />
      <span className="kicker text-flame-400/90">{children}</span>
      <span className="h-px w-8 bg-flame-500/40" />
    </motion.div>
  )
}
