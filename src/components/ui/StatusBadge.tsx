import { cn } from '@/utils/cn'

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info' | 'orange' | 'violet'

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-cocoa/10 text-cocoa',
  positive: 'bg-olive/15 text-olive',
  warning: 'bg-butter/40 text-cocoa',
  negative: 'bg-flame/10 text-flame',
  info: 'bg-sky-100 text-sky-800',
  orange: 'bg-orange-100 text-orange-800',
  violet: 'bg-violet-100 text-violet-800',
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize', toneStyles[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label.replace(/_/g, ' ')}
    </span>
  )
}
