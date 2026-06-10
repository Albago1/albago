'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type BaseProps = {
  variant?: Variant
  size?: Size
  icon?: boolean
  children: ReactNode
  className?: string
}

const base =
  'group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-300 will-change-transform select-none disabled:opacity-50 disabled:cursor-not-allowed'

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-flame-500 text-white shadow-glow-flame hover:bg-flame-400 hover:shadow-glow-soft hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-white/[0.04] text-white ring-1 ring-white/10 hover:bg-white/[0.08] hover:ring-white/20',
  ghost: 'text-white/80 hover:text-white hover:bg-white/[0.05]',
}

type CinematicLinkProps = BaseProps & {
  href: string
  external?: boolean
}

export function CinematicLink({
  href,
  external,
  variant = 'primary',
  size = 'md',
  icon = true,
  className,
  children,
}: CinematicLinkProps) {
  const cls = cn(base, sizes[size], variantStyles[variant], className)
  const content = (
    <>
      {children}
      {icon && (
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      )}
    </>
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  )
}

type NativeButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

export const CinematicButton = forwardRef<HTMLButtonElement, NativeButtonProps>(
  ({ variant = 'primary', size = 'md', icon = false, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(base, sizes[size], variantStyles[variant], className)}
      {...rest}
    >
      {children}
      {icon && (
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      )}
    </button>
  ),
)
CinematicButton.displayName = 'CinematicButton'
