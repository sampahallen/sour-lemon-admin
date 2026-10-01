import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 rounded-3xl border border-cocoa/10 bg-white px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-flame/10 font-display text-2xl font-bold text-flame" aria-hidden="true">?</span>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="max-w-sm text-sm text-cocoa/60">This admin page may have moved. Return to the order workspace to keep going.</p>
      <Button to="/orders">Back to orders</Button>
    </div>
  )
}
