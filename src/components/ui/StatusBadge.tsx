import { cn } from '@/utils/cn'

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative'

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-cocoa/10 text-cocoa',
  positive: 'bg-olive/15 text-olive',
  warning: 'bg-butter/40 text-cocoa',
  negative: 'bg-flame/10 text-flame',
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize', toneStyles[tone])}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}
