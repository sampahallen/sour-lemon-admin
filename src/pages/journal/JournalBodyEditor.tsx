import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  deleteJournalPostImage,
  uploadJournalPostImage,
  type JournalBlock,
  type JournalPostImage,
} from '@/api/journal'
import { createImageFigure, createParagraph, readJournalDocument, writeJournalDocument } from './journalDocument'

type BlockFormat = 'paragraph' | 'heading-2' | 'heading-3' | 'unordered-list' | 'ordered-list' | 'quote'
type InlineFormat = 'bold' | 'italic' | 'underline'
type ImageResizeDrag = {
  pointerId: number
  handle: HTMLButtonElement
  figure: HTMLElement
  edge: string
  startX: number
  startY: number
  startWidth: number
  frameWidth: number
  frameHeight: number
  containerWidth: number
  alignment: 'left' | 'center' | 'right'
}

const blockTools: { label: string; glyph: string; format: BlockFormat }[] = [
  { label: 'Text', glyph: 'Aa', format: 'paragraph' },
  { label: 'Heading', glyph: 'H2', format: 'heading-2' },
  { label: 'Subheading', glyph: 'H3', format: 'heading-3' },
  { label: 'Bullets', glyph: '•', format: 'unordered-list' },
  { label: 'Numbers', glyph: '1.', format: 'ordered-list' },
  { label: 'Quote', glyph: '“', format: 'quote' },
]
const inlineTools: { label: string; glyph: string; format: InlineFormat }[] = [
  { label: 'Bold', glyph: 'B', format: 'bold' },
  { label: 'Italic', glyph: 'I', format: 'italic' },
  { label: 'Underline', glyph: 'U', format: 'underline' },
]

function altTextFromFileName(file: File) {
  return file.name.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Journal photo'
}

function directBlock(root: HTMLElement, node: Node | null): HTMLElement | null {
  let current = node instanceof HTMLElement ? node : node?.parentElement
  while (current && current.parentElement !== root) current = current.parentElement
  return current?.parentElement === root ? current : null
}

function formatOf(block: HTMLElement | null): BlockFormat {
  switch (block?.tagName) {
    case 'H2': return 'heading-2'
    case 'H3': return 'heading-3'
    case 'UL': return 'unordered-list'
    case 'OL': return 'ordered-list'
    case 'BLOCKQUOTE': return 'quote'
    default: return 'paragraph'
  }
}

function placeCaret(element: HTMLElement) {
  const selection = document.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectImageFigure(root: HTMLElement, selected: HTMLElement | null) {
  root.querySelectorAll<HTMLElement>('figure[data-image-id][data-selected]').forEach((figure) => {
    if (figure !== selected) delete figure.dataset.selected
  })
  if (selected) selected.dataset.selected = 'true'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insertionBlockRef = useRef<HTMLElement | null>(null)
  const resizeDragRef = useRef<ImageResizeDrag | null>(null)
  const rendered = useRef('')
  const [activeBlock, setActiveBlock] = useState<BlockFormat>('paragraph')
  const [activeInline, setActiveInline] = useState<Record<InlineFormat, boolean>>({ bold: false, italic: false, underline: false })
  const [uploadedImages, setUploadedImages] = useState<Record<string, JournalPostImage>>({})
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const contentKey = JSON.stringify(blocks)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || rendered.current === contentKey) return
    const images = new Map([...bodyImages, ...Object.values(uploadedImages)].map((image) => [image.id, image]))
    writeJournalDocument(root, blocks, images)
    rendered.current = contentKey
  }, [blocks, bodyImages, uploadedImages, contentKey])

  useEffect(() => {
    const update = () => {
      const root = rootRef.current
      const selection = document.getSelection()
      if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return
      setActiveBlock(formatOf(directBlock(root, selection.anchorNode)))
      setActiveInline({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  useEffect(() => {
    const deselectOutside = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && !root.contains(event.target)) selectImageFigure(root, null)
    }
    document.addEventListener('pointerdown', deselectOutside)
    return () => document.removeEventListener('pointerdown', deselectOutside)
  }, [])

  const sync = () => {
    const root = rootRef.current
    if (!root) return
    const next = readJournalDocument(root)
    const key = JSON.stringify(next)
    if (rendered.current === key) return
    rendered.current = key
    onChange(next)
  }

  const ensureParagraph = () => {
    const root = rootRef.current
    if (!root) return
    if (!root.hasChildNodes()) {
      const paragraph = createParagraph()
      root.append(paragraph)
      placeCaret(paragraph)
      sync()
    }
  }

  const runCommand = (command: string, value?: string) => {
    const root = rootRef.current
    if (!root) return
    root.focus({ preventScroll: true })
    ensureParagraph()
    document.execCommand(command, false, value)
    sync()
  }

  const applyBlock = (format: BlockFormat) => {
    const root = rootRef.current
    if (!root) return
    const current = formatOf(directBlock(root, document.getSelection()?.anchorNode ?? null))
    if (format === 'ordered-list' || format === 'unordered-list') {
      runCommand(format === 'ordered-list' ? 'insertOrderedList' : 'insertUnorderedList')
    } else {
      if (current === 'ordered-list' || current === 'unordered-list') {
        runCommand(current === 'ordered-list' ? 'insertOrderedList' : 'insertUnorderedList')
      }
      runCommand('formatBlock', format === 'heading-2' ? 'h2' : format === 'heading-3' ? 'h3' : format === 'quote' ? 'blockquote' : 'p')
    }
    setActiveBlock(format)
  }

  const insertImage = async (file: File) => {
    setUploadError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPEG, PNG, or WebP photo.')
      return
    }
    setIsUploadingImage(true)
    try {
      const { image } = await uploadJournalPostImage(token, postId, file, {
        role: 'body', altText: altTextFromFileName(file), sortOrder: bodyImages.length,
      })
      setUploadedImages((current) => ({ ...current, [image.id]: image }))
      const root = rootRef.current
      if (!root) return
      const current = insertionBlockRef.current?.parentElement === root
        ? insertionBlockRef.current
        : directBlock(root, document.getSelection()?.anchorNode ?? null)
      insertionBlockRef.current = null
      const figure = createImageFigure({ type: 'image', imageId: image.id, caption: '' }, image)
      const paragraph = createParagraph()
      if (current) current.after(figure, paragraph)
      else root.append(figure, paragraph)
      root.focus({ preventScroll: true })
      placeCaret(paragraph)
      paragraph.scrollIntoView({ block: 'nearest' })
      sync()
      void onImagesChanged()
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'Could not upload this photo.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const removeImage = (imageId: string) => {
    const root = rootRef.current
    const figure = Array.from(root?.querySelectorAll('figure') ?? []).find((item) => item.dataset.imageId === imageId)
    if (!figure) return
    figure.remove()
    sync()
    void deleteJournalPostImage(token, postId, imageId).then(() => onImagesChanged())
  }

  const keepSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()
  const setImageWidth = (figure: HTMLElement, value: number) => {
    const width = Math.min(100, Math.max(25, Math.round(value)))
    figure.dataset.widthPercent = String(width)
    const frame = figure.querySelector<HTMLElement>('.journal-image-frame')
    const caption = figure.querySelector<HTMLElement>('figcaption')
    const input = figure.querySelector<HTMLInputElement>('input[data-image-width]')
    if (frame) frame.style.width = `${width}%`
    if (caption) caption.style.width = `${width}%`
    if (input) input.value = String(width)
  }
  const setImageAlignment = (figure: HTMLElement, alignment: 'left' | 'center' | 'right') => {
    figure.dataset.align = alignment
    figure.querySelectorAll<HTMLButtonElement>('button[data-image-align]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.imageAlign === alignment))
    })
    sync()
  }
  const commitWidthInput = (input: HTMLInputElement) => {
    const figure = input.closest<HTMLElement>('figure[data-image-id]')
    if (!figure) return
    setImageWidth(figure, Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(figure.dataset.widthPercent))
    sync()
  }
  const finishResize = (pointerId: number) => {
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    if (drag.handle.hasPointerCapture(pointerId)) drag.handle.releasePointerCapture(pointerId)
    resizeDragRef.current = null
    sync()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement && event.target.dataset.imageWidth) {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitWidthInput(event.target)
      }
      return
    }
    if (event.target instanceof HTMLButtonElement && event.target.dataset.resizeImage) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const figure = event.target.closest<HTMLElement>('figure[data-image-id]')
        if (figure) {
          const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
          const edge = event.target.dataset.resizeImage
          const axis = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'horizontal' : 'vertical'
          if (axis === 'horizontal' && !edge?.includes('left') && !edge?.includes('right')) return
          if (axis === 'vertical' && !edge?.includes('top') && !edge?.includes('bottom')) return
          const sign = axis === 'horizontal' ? edge?.includes('left') ? -1 : 1 : edge?.includes('top') ? -1 : 1
          setImageWidth(figure, Number(figure.dataset.widthPercent) + direction * sign * 5)
          sync()
        }
      }
      return
    }
    if (event.target instanceof HTMLElement && event.target.classList.contains('journal-image-frame')) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const root = rootRef.current
        const figure = event.target.closest<HTMLElement>('figure[data-image-id]')
        if (root && figure) selectImageFigure(root, figure)
      }
      return
    }
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return
    if (event.key === 'Enter' && !event.shiftKey) {
      const root = rootRef.current
      if (!root) return
      const specialBlock = directBlock(root, document.getSelection()?.anchorNode ?? null)
      if (specialBlock?.tagName !== 'FIGURE' && specialBlock?.tagName !== 'BLOCKQUOTE') return
      event.preventDefault()
      const paragraph = createParagraph()
      specialBlock.after(paragraph)
      root.focus({ preventScroll: true })
      placeCaret(paragraph)
      paragraph.scrollIntoView({ block: 'nearest' })
      sync()
    }
  }

  return (
    <div>
      <div role="toolbar" aria-label="Journal formatting" className="journal-editor-toolbar mb-7 flex w-full min-w-0 flex-nowrap items-center gap-0 overflow-x-auto overscroll-x-contain whitespace-nowrap rounded-xl border border-cocoa/10 bg-white/95 p-1 shadow-sm backdrop-blur sm:gap-1 sm:p-2">
        {blockTools.map((tool) => (
          <button key={tool.format} type="button" title={tool.label} aria-label={tool.label} aria-pressed={activeBlock === tool.format}
            onMouseDown={keepSelection} onClick={() => applyBlock(tool.format)}
            className="flex h-10 w-[1.875rem] shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-cocoa/70 hover:bg-butter/40 aria-pressed:bg-butter aria-pressed:text-cocoa sm:w-9 xl:w-auto xl:px-2.5"
          ><span aria-hidden="true">{tool.glyph}</span><span className="ml-1.5 hidden xl:inline">{tool.label}</span></button>
        ))}
        <span className="mx-0.5 h-6 shrink-0 border-l border-cocoa/15 sm:mx-1" aria-hidden="true" />
        {inlineTools.map((tool) => (
          <button key={tool.format} type="button" title={tool.label} aria-label={tool.label} aria-pressed={activeInline[tool.format]}
            onMouseDown={keepSelection} onClick={() => {
              runCommand(tool.format)
              setActiveInline((current) => ({ ...current, [tool.format]: document.queryCommandState(tool.format) }))
            }}
            className={`flex h-10 w-[1.875rem] shrink-0 items-center justify-center rounded-lg text-base text-cocoa/70 hover:bg-butter/40 aria-pressed:bg-butter aria-pressed:text-cocoa sm:w-9 ${tool.format === 'bold' ? 'font-bold' : tool.format === 'italic' ? 'italic' : 'underline'}`}
          >{tool.glyph}</button>
        ))}
        <span className="mx-0.5 h-6 shrink-0 border-l border-cocoa/15 sm:mx-1" aria-hidden="true" />
        <button type="button" title="Insert photo" disabled={isUploadingImage} onMouseDown={keepSelection}
          onClick={() => {
            const root = rootRef.current
            insertionBlockRef.current = root ? directBlock(root, document.getSelection()?.anchorNode ?? null) : null
            fileInputRef.current?.click()
          }}
          className="flex h-10 w-[1.875rem] shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-cocoa/70 hover:bg-butter/40 disabled:opacity-40 sm:w-9 xl:w-auto xl:px-2.5"
        ><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3.5 3 2.5-2.5L20 18" /></svg><span className="ml-1.5 hidden xl:inline">Photo</span></button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void insertImage(file)
            event.target.value = ''
          }} />
      </div>
      {uploadError ? <p className="mb-3 text-sm font-semibold text-flame">{uploadError}</p> : null}
      <div ref={rootRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Journal body"
        aria-multiline="true" data-placeholder="Start writing…"
        className={`journal-document min-h-[32rem] rounded-2xl p-3 outline-none ${isDragOver ? 'bg-flame/5 outline-dashed outline-2 outline-flame/40' : ''}`}
        onFocus={() => {
          document.execCommand('defaultParagraphSeparator', false, 'p')
          ensureParagraph()
        }}
        onInput={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.dataset.imageWidth) return
          sync()
        }}
        onPointerDown={(event) => {
          if (!(event.target instanceof HTMLElement)) return
          const handle = event.target.closest<HTMLButtonElement>('button[data-resize-image]')
          const figure = handle?.closest<HTMLElement>('figure[data-image-id]')
          const root = rootRef.current
          if (!handle || !figure || !root || (event.pointerType === 'mouse' && event.button !== 0)) return
          event.preventDefault()
          selectImageFigure(root, figure)
          handle.setPointerCapture(event.pointerId)
          resizeDragRef.current = {
            pointerId: event.pointerId,
            handle,
            figure,
            edge: handle.dataset.resizeImage ?? 'right',
            startX: event.clientX,
            startY: event.clientY,
            startWidth: Number(figure.dataset.widthPercent) || 100,
            frameWidth: Math.max(1, handle.parentElement?.getBoundingClientRect().width ?? 1),
            frameHeight: Math.max(1, handle.parentElement?.getBoundingClientRect().height ?? 1),
            containerWidth: Math.max(1, figure.getBoundingClientRect().width),
            alignment: figure.dataset.align === 'left' || figure.dataset.align === 'right' ? figure.dataset.align : 'center',
          }
        }}
        onPointerMove={(event) => {
          const drag = resizeDragRef.current
          if (!drag || drag.pointerId !== event.pointerId) return
          const horizontal = drag.edge.includes('left') || drag.edge.includes('right')
          const vertical = drag.edge.includes('top') || drag.edge.includes('bottom')
          const horizontalSign = drag.edge.includes('left') ? -1 : 1
          const verticalSign = drag.edge.includes('top') ? -1 : 1
          const horizontalChange = horizontal
            ? ((event.clientX - drag.startX) * horizontalSign * (drag.alignment === 'center' ? 200 : 100)) / drag.containerWidth
            : 0
          const verticalChange = vertical
            ? ((event.clientY - drag.startY) * verticalSign * drag.frameWidth * 100) / (drag.frameHeight * drag.containerWidth)
            : 0
          const change = horizontal && vertical
            ? Math.abs(horizontalChange) > Math.abs(verticalChange) ? horizontalChange : verticalChange
            : horizontalChange + verticalChange
          setImageWidth(drag.figure, drag.startWidth + change)
        }}
        onPointerUp={(event) => finishResize(event.pointerId)}
        onPointerCancel={(event) => finishResize(event.pointerId)}
        onFocusCapture={(event) => {
          const target = event.target
          if (!(target instanceof HTMLElement)) return
          const figure = target.closest<HTMLElement>('figure[data-image-id]')
          const root = rootRef.current
          if (root && figure) selectImageFigure(root, figure)
        }}
        onKeyUp={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.dataset.imageWidth && ['ArrowUp', 'ArrowDown'].includes(event.key)) commitWidthInput(event.target)
        }}
        onBlurCapture={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.dataset.imageWidth) commitWidthInput(event.target)
        }}
        onKeyDown={handleKeyDown}
        onPaste={(event) => {
          event.preventDefault()
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
        }}
        onClick={(event) => {
          const target = event.target
          if (target instanceof HTMLElement && target.dataset.removeImage) {
            removeImage(target.dataset.removeImage)
            return
          }
          const alignmentButton = target instanceof HTMLElement ? target.closest<HTMLButtonElement>('button[data-image-align]') : null
          if (alignmentButton) {
            const figure = alignmentButton.closest<HTMLElement>('figure[data-image-id]')
            const alignment = alignmentButton.dataset.imageAlign
            if (figure && (alignment === 'left' || alignment === 'center' || alignment === 'right')) setImageAlignment(figure, alignment)
            return
          }
          const root = rootRef.current
          if (!root) return
          const figure = target instanceof HTMLElement ? target.closest<HTMLElement>('figure[data-image-id]') : null
          selectImageFigure(root, figure)
          if (target === event.currentTarget) {
            const last = root.lastElementChild
            if (last?.tagName === 'P') {
              const selection = document.getSelection()
              if (selection) {
                const range = document.createRange()
                range.selectNodeContents(last)
                range.collapse(false)
                selection.removeAllRanges()
                selection.addRange(range)
              }
            } else {
              const paragraph = createParagraph()
              root.append(paragraph)
              placeCaret(paragraph)
              sync()
            }
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setIsDragOver(true) }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return
          event.preventDefault()
          setIsDragOver(false)
          const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
          if (file) void insertImage(file)
        }}
      />
    </div>
  )
}
