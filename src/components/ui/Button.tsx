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
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl font-body font-bold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame',
    disabled && 'pointer-events-none opacity-50',
    size === 'lg' ? 'px-7 py-3 text-base' : 'px-4 py-2.5 text-sm',
    variant === 'primary'
      ? 'bg-flame text-white shadow-sm hover:bg-[#dd5629]'
      : cn('border bg-white hover:bg-cream/45', accentStyles[accent]),
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
