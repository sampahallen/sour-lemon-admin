import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-cocoa/40"
            onClick={onClose}
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          />
          <motion.div
            className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-cream p-6 shadow-xl"
            initial={prefersReducedMotion ? undefined : { x: '100%' }}
            animate={prefersReducedMotion ? undefined : { x: 0 }}
            exit={prefersReducedMotion ? undefined : { x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 text-cocoa/60 hover:bg-cocoa/10" aria-label="Close">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
