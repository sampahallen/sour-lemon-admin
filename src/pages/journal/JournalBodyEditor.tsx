import { useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import {
  deleteJournalPostImage,
  uploadJournalPostImage,
  type JournalBlock,
  type JournalListBlock,
  type JournalPostImage,
} from '@/api/journal'
import { createEmptyBlock } from './journalBlocks'

function updateAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, itemIndex) => (itemIndex === index ? next : item))
}

function altTextFromFileName(file: File) {
  return file.name.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Journal photo'
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const paragraphClasses =
  'w-full resize-none overflow-hidden whitespace-pre-line bg-transparent text-lg leading-8 text-cocoa/80 outline-none placeholder:text-cocoa/30'
const heading2Classes =
  'w-full bg-transparent font-display text-3xl font-bold text-cocoa outline-none placeholder:text-cocoa/25 sm:text-4xl'
const heading3Classes =
  'w-full bg-transparent font-display text-2xl font-bold text-cocoa outline-none placeholder:text-cocoa/25 sm:text-3xl'
const listItemClasses = 'w-full bg-transparent text-lg leading-8 text-cocoa/80 outline-none placeholder:text-cocoa/30'
const quoteTextClasses =
  'w-full resize-none overflow-hidden bg-transparent font-display text-2xl font-semibold leading-relaxed text-cocoa outline-none placeholder:text-cocoa/30'
const quoteAttributionClasses =
  'w-full bg-transparent text-sm font-semibold text-cocoa/50 outline-none placeholder:text-cocoa/30'
const captionClasses = 'w-full bg-transparent text-center text-sm text-cocoa/55 outline-none placeholder:text-cocoa/30'

const TOOLBAR_ITEMS: { label: string; glyph: string; block: () => JournalBlock }[] = [
  { label: 'Text', glyph: '¶', block: () => createEmptyBlock('paragraph') },
  { label: 'Heading', glyph: 'H2', block: () => ({ type: 'heading', level: 2, text: '' }) },
  { label: 'Subheading', glyph: 'H3', block: () => ({ type: 'heading', level: 3, text: '' }) },
  { label: 'Bulleted list', glyph: '•—', block: () => ({ type: 'list', style: 'unordered', items: [''] }) },
  { label: 'Numbered list', glyph: '1—', block: () => ({ type: 'list', style: 'ordered', items: [''] }) },
  { label: 'Quote', glyph: '❝', block: () => ({ type: 'quote', text: '', attribution: '' }) },
]

type ToolbarFormat = 'paragraph' | 'heading-2' | 'heading-3' | 'unordered-list' | 'ordered-list' | 'quote'

const blockFormat = (block: JournalBlock | undefined): ToolbarFormat | null => {
  if (!block || block.type === 'image') return null
  if (block.type === 'heading') return block.level === 2 ? 'heading-2' : 'heading-3'
  if (block.type === 'list') return block.style === 'unordered' ? 'unordered-list' : 'ordered-list'
  return block.type
}

const blockText = (block: Exclude<JournalBlock, { type: 'image' }>) =>
  block.type === 'list' ? block.items.join('\n') : block.text

const formatBlock = (
  block: Exclude<JournalBlock, { type: 'image' }>,
  format: ToolbarFormat,
): Exclude<JournalBlock, { type: 'image' }> => {
  const text = blockText(block)
  switch (format) {
    case 'paragraph':
      return { type: 'paragraph', text }
    case 'heading-2':
      return { type: 'heading', level: 2, text }
    case 'heading-3':
      return { type: 'heading', level: 3, text }
    case 'unordered-list':
    case 'ordered-list':
      return {
        type: 'list',
        style: format === 'unordered-list' ? 'unordered' : 'ordered',
        items: block.type === 'list' ? block.items : text.split('\n'),
      }
    case 'quote':
      return { type: 'quote', text, attribution: block.type === 'quote' ? block.attribution : '' }
  }
}

export function JournalBodyEditor({
  blocks,
  onChange,
  bodyImages,
  token,
  postId,
  onImagesChanged,
}: {
  blocks: JournalBlock[]
  onChange: (blocks: JournalBlock[]) => void
  bodyImages: JournalPostImage[]
  token: string
  postId: string
  onImagesChanged: () => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const controlRefs = useRef(new Map<string, HTMLElement>())
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Record<string, JournalPostImage>>({})
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const imagesById: Record<string, JournalPostImage> = { ...uploadedImages }
  for (const image of bodyImages) imagesById[image.id] = image

  const registerRef = (key: string) => (el: HTMLElement | null) => {
    if (el) controlRefs.current.set(key, el)
    else controlRefs.current.delete(key)
  }

  const updateBlock = (index: number, next: JournalBlock) => onChange(updateAt(blocks, index, next))

  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= blocks.length) return
    const reordered = [...blocks]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    onChange(reordered)
    if (activeIndex === index) setActiveIndex(nextIndex)
    else if (activeIndex === nextIndex) setActiveIndex(index)
  }

  const removeBlock = (index: number) => {
    const block = blocks[index]
    onChange(blocks.filter((_, itemIndex) => itemIndex !== index))
    setActiveIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
    if (block.type === 'image' && block.imageId) {
      void deleteJournalPostImage(token, postId, block.imageId).then(() => onImagesChanged())
    }
  }

  const focusControl = (key: string) => controlRefs.current.get(key)?.focus()

  // flushSync forces the new block's DOM node to exist before we call .focus(),
  // all inside this same event handler. Without it, focus would only land on the
  // new control on a later effect/render pass — leaving the still-focused toolbar
  // button to eat the next keystroke (Enter/Space activate a focused <button>).
  const insertBlockAfter = (afterIndex: number, block: JournalBlock, itemIndex?: number) => {
    const insertAt = afterIndex + 1
    flushSync(() => {
      onChange([...blocks.slice(0, insertAt), block, ...blocks.slice(insertAt)])
    })
    setActiveIndex(insertAt)
    focusControl(itemIndex !== undefined ? `${insertAt}:${itemIndex}` : `${insertAt}`)
  }

  const toggleFormat = (format: ToolbarFormat) => {
    const currentIndex = activeIndex
    const current = currentIndex === null ? undefined : blocks[currentIndex]
    if (currentIndex === null || !current || current.type === 'image') {
      const nextBlock = formatBlock({ type: 'paragraph', text: '' }, format)
      insertBlockAfter(
        currentIndex ?? blocks.length - 1,
        nextBlock,
        nextBlock.type === 'list' ? 0 : undefined,
      )
      return
    }

    const nextFormat = blockFormat(current) === format && format !== 'paragraph' ? 'paragraph' : format
    const nextBlock = formatBlock(current, nextFormat)
    flushSync(() => updateBlock(currentIndex, nextBlock))
    focusControl(nextBlock.type === 'list' ? `${currentIndex}:0` : `${currentIndex}`)
  }

  const appendParagraph = () => insertBlockAfter(blocks.length - 1, createEmptyBlock('paragraph'))

  const insertImage = async (file: File) => {
    setUploadError(null)
    setIsUploadingImage(true)
    try {
      const { image } = await uploadJournalPostImage(token, postId, file, {
        role: 'body',
        altText: altTextFromFileName(file),
        sortOrder: bodyImages.length,
      })
      setUploadedImages((current) => ({ ...current, [image.id]: image }))
      insertBlockAfter(activeIndex ?? blocks.length - 1, { type: 'image', imageId: image.id, caption: '' })
      void onImagesChanged()
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'Could not upload this photo.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleContinueAfter = (index: number) => insertBlockAfter(index, createEmptyBlock('paragraph'))

  const handleListItemKeyDown = (
    index: number,
    itemIndex: number,
    block: JournalListBlock,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const items = [...block.items.slice(0, itemIndex + 1), '', ...block.items.slice(itemIndex + 1)]
      flushSync(() => updateBlock(index, { ...block, items }))
      focusControl(`${index}:${itemIndex + 1}`)
    } else if (event.key === 'Backspace' && block.items[itemIndex] === '' && block.items.length > 1) {
      event.preventDefault()
      const items = block.items.filter((_, i) => i !== itemIndex)
      flushSync(() => updateBlock(index, { ...block, items }))
      focusControl(`${index}:${Math.max(0, itemIndex - 1)}`)
    }
  }

  return (
    <div>
      <div className="sticky top-4 z-10 mb-4 flex flex-wrap items-center gap-1 rounded-full border border-cocoa/10 bg-white/95 p-1.5 shadow-sm backdrop-blur">
        {TOOLBAR_ITEMS.map((item) => {
          const format = blockFormat(item.block())!
          const isActive = blockFormat(activeIndex === null ? undefined : blocks[activeIndex]) === format
          return (
            <button
              key={item.label}
              type="button"
              title={isActive && format !== 'paragraph' ? `${item.label} (click to remove)` : item.label}
              aria-label={item.label}
              aria-pressed={isActive}
              onClick={() => toggleFormat(format)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-flame text-white shadow-sm'
                  : 'text-cocoa/60 hover:bg-flame/10 hover:text-flame'
              }`}
            >
              {item.glyph}
            </button>
          )
        })}
        <button
          type="button"
          title="Insert photo"
          disabled={isUploadingImage}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-cocoa/60 hover:bg-flame/10 hover:text-flame disabled:opacity-40"
        >
          {isUploadingImage ? 'Uploading…' : '🖼 Photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void insertImage(file)
            event.target.value = ''
          }}
        />
      </div>

      {uploadError ? <p className="mb-3 text-sm font-semibold text-flame">{uploadError}</p> : null}

      <div
        className={`flex flex-col gap-6 rounded-2xl p-2 transition-colors ${isDragOver ? 'bg-flame/5 outline-dashed outline-2 outline-flame/40' : ''}`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault()
            setIsDragOver(true)
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
          if (file) void insertImage(file)
        }}
      >
        {blocks.length === 0 ? (
          <button
            type="button"
            onClick={() => insertBlockAfter(-1, createEmptyBlock('paragraph'))}
            className="rounded-xl border-2 border-dashed border-cocoa/15 py-12 text-center text-lg text-cocoa/40 hover:border-flame/40 hover:text-cocoa/60"
          >
            Click to start writing, or use the toolbar above to add a heading, list, quote, or photo.
          </button>
        ) : (
          blocks.map((block, index) => (
            <div key={index} className="group relative" onFocus={() => setActiveIndex(index)}>
              <div className="absolute -left-9 top-0.5 hidden flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  className="rounded p-1 text-xs font-bold text-cocoa/35 hover:bg-cocoa/10 hover:text-cocoa disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  className="rounded p-1 text-xs font-bold text-cocoa/35 hover:bg-cocoa/10 hover:text-cocoa disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => removeBlock(index)}
                  className="rounded p-1 text-xs font-bold text-flame/50 hover:bg-flame/10 hover:text-flame"
                >
                  ×
                </button>
              </div>

              {block.type === 'paragraph' ? (
                <textarea
                  ref={(el) => {
                    registerRef(`${index}`)(el)
                    autoGrow(el)
                  }}
                  value={block.text}
                  rows={1}
                  placeholder="Write here…"
                  className={paragraphClasses}
                  onChange={(event) => {
                    updateBlock(index, { ...block, text: event.target.value })
                    autoGrow(event.currentTarget)
                  }}
                />
              ) : null}

              {block.type === 'heading' ? (
                <input
                  ref={registerRef(`${index}`)}
                  value={block.text}
                  placeholder={block.level === 2 ? 'Heading' : 'Subheading'}
                  className={block.level === 2 ? heading2Classes : heading3Classes}
                  onChange={(event) => updateBlock(index, { ...block, text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleContinueAfter(index)
                    }
                  }}
                />
              ) : null}

              {block.type === 'list' ? (
                <ul className={`flex flex-col gap-1.5 pl-6 ${block.style === 'ordered' ? 'list-decimal' : 'list-disc'}`}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <input
                        ref={registerRef(`${index}:${itemIndex}`)}
                        value={item}
                        placeholder="List item"
                        className={listItemClasses}
                        onChange={(event) =>
                          updateBlock(index, { ...block, items: updateAt(block.items, itemIndex, event.target.value) })
                        }
                        onKeyDown={(event) => handleListItemKeyDown(index, itemIndex, block, event)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {block.type === 'quote' ? (
                <div className="rounded-r-2xl border-l-4 border-flame bg-butter/25 px-6 py-5">
                  <textarea
                    ref={(el) => {
                      registerRef(`${index}`)(el)
                      autoGrow(el)
                    }}
                    value={block.text}
                    rows={1}
                    placeholder="Quote"
                    className={quoteTextClasses}
                    onChange={(event) => {
                      updateBlock(index, { ...block, text: event.target.value })
                      autoGrow(event.currentTarget)
                    }}
                  />
                  <input
                    value={block.attribution ?? ''}
                    placeholder="— Attribution (optional)"
                    className={`${quoteAttributionClasses} mt-2`}
                    onChange={(event) => updateBlock(index, { ...block, attribution: event.target.value })}
                  />
                </div>
              ) : null}

              {block.type === 'image' ? (
                <figure>
                  {imagesById[block.imageId] ? (
                    <img
                      src={imagesById[block.imageId].url}
                      alt={imagesById[block.imageId].altText}
                      className="max-h-[28rem] w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-cocoa/5 text-sm text-cocoa/40">
                      Photo unavailable
                    </div>
                  )}
                  <input
                    ref={registerRef(`${index}`)}
                    value={block.caption ?? ''}
                    placeholder="Add a caption…"
                    className={`${captionClasses} mt-3`}
                    onChange={(event) => updateBlock(index, { ...block, caption: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleContinueAfter(index)
                      }
                    }}
                  />
                </figure>
              ) : null}
            </div>
          ))
        )}

        {blocks.length > 0 ? (
          <button
            type="button"
            onClick={appendParagraph}
            className="rounded-lg py-2 text-left text-cocoa/30 hover:text-cocoa/50"
          >
            Click to continue writing…
          </button>
        ) : null}
      </div>
    </div>
  )
}
