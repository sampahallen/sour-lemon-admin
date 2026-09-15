export function AppLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream text-cocoa"
    >
      <div className="h-11 w-11 animate-spin rounded-full border-4 border-flame/20 border-t-flame" />
      <p className="text-sm font-semibold text-cocoa/60">Loading Sour Lemon...</p>
      <span className="sr-only">Checking your session</span>
    </div>
  )
}
