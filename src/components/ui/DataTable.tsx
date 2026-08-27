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
      <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
        {emptyState ?? 'Nothing here yet.'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-cocoa/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-cocoa/10 text-cocoa/60">
            {columns.map((column) => (
              <th key={column.header} className={cn('whitespace-nowrap px-4 py-3 font-semibold', column.className)}>
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
              className={cn('border-b border-cocoa/5 last:border-0', onRowClick && 'cursor-pointer hover:bg-cocoa/5')}
            >
              {columns.map((column) => (
                <td key={column.header} className={cn('px-4 py-3', column.className)}>
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
