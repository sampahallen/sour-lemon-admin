import { cn } from '@/utils/cn'

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info' | 'orange' | 'violet'

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  positive: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-800',
  negative: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-100 text-sky-800',
  orange: 'bg-orange-100 text-orange-800',
  violet: 'bg-violet-100 text-violet-800',
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold capitalize', toneStyles[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label.replace(/_/g, ' ')}
    </span>
  )
}
