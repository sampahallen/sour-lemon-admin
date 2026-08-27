import type { ReactNode } from 'react'
import type { JournalBlock, JournalPostImage } from '@/api/journal'
import { JOURNAL_BLOCK_LABELS, createEmptyBlock } from './journalBlocks'

function updateAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, itemIndex) => (itemIndex === index ? next : item))
}

function BlockShell({
  label,
  index,
  total,
  onMove,
  onRemove,
  children,
}: {
  label: string
  index: number
  total: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-cocoa/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-cocoa/50 uppercase">{label}</span>
        <div className="flex items-center gap-3 text-xs font-semibold text-cocoa/60">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>
            ↑ Move up
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>
            ↓ Move down
          </button>
          <button type="button" className="text-flame" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

export function JournalBodyEditor({
  blocks,
  onChange,
  bodyImages,
}: {
  blocks: JournalBlock[]
  onChange: (blocks: JournalBlock[]) => void
  bodyImages: JournalPostImage[]
}) {
  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= blocks.length) return
    const reordered = [...blocks]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    onChange(reordered)
  }

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, itemIndex) => itemIndex !== index))
  }

  const addBlock = (type: JournalBlock['type']) => {
    onChange([...blocks, createEmptyBlock(type)])
  }

  return (
    <div className="flex flex-col gap-4">
      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cocoa/20 p-6 text-center text-sm text-cocoa/60">
          No content blocks yet. Add one below to start writing the post.
        </div>
      ) : (
        blocks.map((block, index) => (
          <BlockShell
            key={index}
            label={JOURNAL_BLOCK_LABELS[block.type]}
            index={index}
            total={blocks.length}
            onMove={(direction) => moveBlock(index, direction)}
            onRemove={() => removeBlock(index)}
          >
            {block.type === 'paragraph' ? (
              <textarea
                value={block.text}
                onChange={(event) => onChange(updateAt(blocks, index, { ...block, text: event.target.value }))}
                rows={4}
                placeholder="Write a paragraph…"
                className={inputClasses}
              />
            ) : null}

            {block.type === 'heading' ? (
              <div className="flex flex-col gap-2">
                <select
                  value={block.level}
                  onChange={(event) =>
                    onChange(
                      updateAt(blocks, index, { ...block, level: Number(event.target.value) as 2 | 3 }),
                    )
                  }
                  className={inputClasses}
                >
                  <option value={2}>Heading (large)</option>
                  <option value={3}>Heading (small)</option>
                </select>
                <input
                  value={block.text}
                  onChange={(event) => onChange(updateAt(blocks, index, { ...block, text: event.target.value }))}
                  placeholder="Heading text"
                  className={inputClasses}
                />
              </div>
            ) : null}

            {block.type === 'list' ? (
              <div className="flex flex-col gap-2">
                <select
                  value={block.style}
                  onChange={(event) =>
                    onChange(
                      updateAt(blocks, index, {
                        ...block,
                        style: event.target.value as 'ordered' | 'unordered',
                      }),
                    )
                  }
                  className={inputClasses}
                >
                  <option value="unordered">Bulleted list</option>
                  <option value="ordered">Numbered list</option>
                </select>
                {block.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    <input
                      value={item}
                      onChange={(event) =>
                        onChange(
                          updateAt(blocks, index, {
                            ...block,
                            items: updateAt(block.items, itemIndex, event.target.value),
                          }),
                        )
                      }
                      placeholder={`Item ${itemIndex + 1}`}
                      className={inputClasses}
                    />
                    <button
                      type="button"
                      className="text-xs font-semibold text-cocoa/60"
                      disabled={block.items.length === 1}
                      onClick={() =>
                        onChange(
                          updateAt(blocks, index, {
                            ...block,
                            items: block.items.filter((_, i) => i !== itemIndex),
                          }),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="self-start text-xs font-semibold text-flame"
                  onClick={() => onChange(updateAt(blocks, index, { ...block, items: [...block.items, ''] }))}
                >
                  + Add item
                </button>
              </div>
            ) : null}

            {block.type === 'quote' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={block.text}
                  onChange={(event) => onChange(updateAt(blocks, index, { ...block, text: event.target.value }))}
                  rows={3}
                  placeholder="Quote text"
                  className={inputClasses}
                />
                <input
                  value={block.attribution ?? ''}
                  onChange={(event) =>
                    onChange(updateAt(blocks, index, { ...block, attribution: event.target.value }))
                  }
                  placeholder="Attribution (optional)"
                  className={inputClasses}
                />
              </div>
            ) : null}

            {block.type === 'image' ? (
              <div className="flex flex-col gap-2">
                {bodyImages.length === 0 ? (
                  <p className="text-sm text-cocoa/60">
                    Upload a body photo below, then pick it here.
                  </p>
                ) : (
                  <select
                    value={block.imageId}
                    onChange={(event) =>
                      onChange(updateAt(blocks, index, { ...block, imageId: event.target.value }))
                    }
                    className={inputClasses}
                  >
                    <option value="">Choose a photo…</option>
                    {bodyImages.map((image) => (
                      <option key={image.id} value={image.id}>
                        {image.altText}
                      </option>
                    ))}
                  </select>
                )}
                {block.imageId ? (
                  <img
                    src={bodyImages.find((image) => image.id === block.imageId)?.url}
                    alt=""
                    className="h-32 w-full rounded-lg object-cover"
                  />
                ) : null}
                <input
                  value={block.caption ?? ''}
                  onChange={(event) => onChange(updateAt(blocks, index, { ...block, caption: event.target.value }))}
                  placeholder="Caption (optional)"
                  className={inputClasses}
                />
              </div>
            ) : null}
          </BlockShell>
        ))
      )}

      <div className="flex flex-wrap gap-2 border-t border-cocoa/10 pt-4">
        {(Object.keys(JOURNAL_BLOCK_LABELS) as JournalBlock['type'][]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="rounded-full border-2 border-cocoa/20 px-4 py-1.5 text-sm font-semibold text-cocoa/70 hover:border-flame hover:text-flame"
          >
            + {JOURNAL_BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
