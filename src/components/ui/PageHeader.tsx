import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-cocoa/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cocoa/45">Sour Lemon / Admin</p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-cocoa">{title}</h1>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}
