import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-cocoa/70">That admin page doesn't exist.</p>
      <Button to="/orders">Back to orders</Button>
    </div>
  )
}
