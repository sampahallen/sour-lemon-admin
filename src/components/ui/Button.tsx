import type { ReactNode, MouseEventHandler } from 'react'
import { Link } from 'react-router'
import { cn } from '@/utils/cn'

type ButtonProps = {
  children: ReactNode
  to?: string
  href?: string
  onClick?: MouseEventHandler
  type?: 'button' | 'submit'
  variant?: 'primary' | 'outline'
  accent?: 'flame' | 'olive' | 'cocoa' | 'cream'
  size?: 'md' | 'lg'
  className?: string
  disabled?: boolean
}

const accentStyles: Record<'flame' | 'olive' | 'cocoa' | 'cream', string> = {
  flame: 'border-flame text-flame',
  olive: 'border-olive text-olive',
  cocoa: 'border-cocoa text-cocoa',
  cream: 'border-cream text-cream',
}

export function Button({
  children,
  to,
  href,
  onClick,
  type = 'button',
  variant = 'primary',
  accent = 'flame',
  size = 'md',
  className = '',
  disabled = false,
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0',
    disabled && 'pointer-events-none opacity-50',
    size === 'lg' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base',
    variant === 'primary'
      ? 'bg-flame text-cream shadow-[var(--shadow-chunky)] hover:shadow-[var(--shadow-chunky-sm)]'
      : cn('border-2 bg-transparent', accentStyles[accent]),
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  if (href) {
    const isExternal = href.startsWith('http')
    return (
      <a href={href} className={classes} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled}>
      {children}
    </button>
  )
}
