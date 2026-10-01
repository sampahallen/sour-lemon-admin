import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface DataTableColumn<T> {
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, emptyState }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cocoa/15 bg-white p-12 text-center text-sm text-cocoa/60">
        {emptyState ?? 'Nothing here yet.'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-cocoa/10 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#faf9f6]">
          <tr className="border-b border-cocoa/10 text-cocoa/55">
            {columns.map((column) => (
              <th key={column.header} className={cn('whitespace-nowrap px-5 py-3 text-xs font-bold uppercase tracking-wide', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onRowClick(row)
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn('border-b border-cocoa/5 last:border-0', onRowClick && 'cursor-pointer hover:bg-cream/30 focus:bg-cream/30')}
            >
              {columns.map((column) => (
                <td key={column.header} className={cn('px-5 py-4', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
