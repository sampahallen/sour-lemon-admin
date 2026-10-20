import type { JournalBlock, JournalPostImage, JournalTextRun } from '@/api/journal'

type Marks = Omit<JournalTextRun, 'text'>

function sameMarks(a: Marks, b: Marks) {
  return Boolean(a.bold) === Boolean(b.bold)
    && Boolean(a.italic) === Boolean(b.italic)
    && Boolean(a.underline) === Boolean(b.underline)
}

export function readTextRuns(element: HTMLElement): JournalTextRun[] {
  const runs: JournalTextRun[] = []
  const append = (text: string, marks: Marks) => {
    if (!text) return
    const previous = runs[runs.length - 1]
    if (previous && sameMarks(previous, marks)) previous.text += text
    else runs.push({ text, ...marks })
  }
  const visit = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent ?? '', marks)
      return
    }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName.toLowerCase()
    if (tag === 'br') {
      if (node.nextSibling) append('\n', marks)
      return
    }
    const next: Marks = {
      bold: marks.bold || tag === 'b' || tag === 'strong' || /^(bold|[6-9]00)$/.test(node.style.fontWeight),
      italic: marks.italic || tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic',
      underline: marks.underline || tag === 'u' || node.style.textDecoration.includes('underline'),
    }
    for (const child of node.childNodes) visit(child, next)
  }
  for (const child of element.childNodes) {
    if (child instanceof HTMLElement && ['DIV', 'P'].includes(child.tagName) && runs.length && !runs[runs.length - 1].text.endsWith('\n')) {
      append('\n', {})
    }
    visit(child, {})
  }
  return runs
}

function textValue(element: HTMLElement) {
  const runs = readTextRuns(element)
  const text = runs.map((run) => run.text).join('')
  return {
    text,
    runs: runs.some((run) => run.bold || run.italic || run.underline) ? runs : undefined,
  }
}

function writeText(element: HTMLElement, text: string, runs?: JournalTextRun[]) {
  const content = runs?.map((run) => run.text).join('') === text ? runs : [{ text }]
  for (const run of content) {
    if (!run.text) continue
    let node: Node = document.createTextNode(run.text)
    for (const [enabled, tag] of [
      [run.underline, 'u'],
      [run.italic, 'em'],
      [run.bold, 'strong'],
    ] as const) {
      if (!enabled) continue
      const wrapper = document.createElement(tag)
      wrapper.append(node)
      node = wrapper
    }
    element.append(node)
  }
  if (!element.hasChildNodes()) element.append(document.createElement('br'))
}

export function createParagraph() {
  const element = document.createElement('p')
  element.append(document.createElement('br'))
  return element
}

export function createImageFigure(block: Extract<JournalBlock, { type: 'image' }>, image?: JournalPostImage) {
  const figure = document.createElement('figure')
  figure.dataset.imageId = block.imageId
  const alignment = block.alignment === 'left' || block.alignment === 'right' ? block.alignment : 'center'
  figure.dataset.align = alignment
  const widthPercent = typeof block.widthPercent === 'number' && Number.isFinite(block.widthPercent)
    ? Math.min(100, Math.max(25, block.widthPercent))
    : 100
  figure.dataset.widthPercent = String(widthPercent)
  figure.contentEditable = 'false'
  const frame = document.createElement('div')
  frame.className = 'journal-image-frame'
  frame.style.width = `${widthPercent}%`
  frame.tabIndex = 0
  frame.setAttribute('role', 'group')
  frame.setAttribute('aria-label', `Journal image: ${image?.altText || 'photo'}`)
  if (image) {
    const photo = document.createElement('img')
    photo.src = image.url
    photo.alt = image.altText
    frame.append(photo)
  } else {
    const unavailable = document.createElement('div')
    unavailable.className = 'journal-document-image-missing'
    unavailable.textContent = 'Photo unavailable'
    frame.append(unavailable)
  }
  for (const edge of ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left']) {
    const resizeHandle = document.createElement('button')
    resizeHandle.type = 'button'
    resizeHandle.className = 'journal-image-resize-handle'
    resizeHandle.dataset.resizeImage = edge
    resizeHandle.setAttribute('aria-label', `Resize image from ${edge.replace('-', ' ')}; drag or use arrow keys`)
    frame.append(resizeHandle)
  }
  figure.append(frame)
  const caption = document.createElement('figcaption')
  caption.dataset.placeholder = 'Add a caption…'
  caption.contentEditable = 'true'
  caption.textContent = block.caption ?? ''
  caption.style.width = `${widthPercent}%`
  figure.append(caption)
  const toolbar = document.createElement('div')
  toolbar.className = 'journal-image-toolbar'
  toolbar.setAttribute('role', 'group')
  toolbar.setAttribute('aria-label', 'Image controls')
  const sizeControl = document.createElement('label')
  sizeControl.className = 'journal-image-width-field'
  sizeControl.textContent = 'Width'
  const widthInput = document.createElement('input')
  widthInput.type = 'number'
  widthInput.min = '25'
  widthInput.max = '100'
  widthInput.step = '1'
  widthInput.value = String(widthPercent)
  widthInput.dataset.imageWidth = block.imageId
  widthInput.setAttribute('aria-label', `Width of ${image?.altText || 'journal photo'} in percent`)
  const percent = document.createElement('span')
  percent.textContent = '%'
  sizeControl.append(widthInput, percent)
  toolbar.append(sizeControl)
  const alignmentControls = document.createElement('div')
  alignmentControls.className = 'journal-image-alignment'
  alignmentControls.setAttribute('role', 'group')
  alignmentControls.setAttribute('aria-label', 'Image alignment')
  const alignmentLabel = document.createElement('span')
  alignmentLabel.className = 'journal-image-alignment-label'
  alignmentLabel.textContent = 'Align'
  alignmentControls.append(alignmentLabel)
  for (const option of ['left', 'center', 'right'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.imageAlign = option
    button.setAttribute('aria-label', `Align image ${option}`)
    button.setAttribute('aria-pressed', String(alignment === option))
    button.title = `Align ${option}`
    const icon = document.createElement('span')
    icon.className = `journal-image-align-icon journal-image-align-icon-${option}`
    icon.setAttribute('aria-hidden', 'true')
    for (const length of [14, 9, 14]) {
      const line = document.createElement('span')
      line.style.width = `${length}px`
      icon.append(line)
    }
    button.append(icon)
    alignmentControls.append(button)
  }
  toolbar.append(alignmentControls)
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.dataset.removeImage = block.imageId
  remove.setAttribute('aria-label', 'Remove photo')
  remove.textContent = 'Remove photo'
  toolbar.append(remove)
  figure.append(toolbar)
  return figure
}

export function writeJournalDocument(root: HTMLElement, blocks: JournalBlock[], images: Map<string, JournalPostImage>) {
  root.replaceChildren()
  for (const block of blocks) {
    if (block.type === 'image') {
      root.append(createImageFigure(block, images.get(block.imageId)))
      continue
    }
    if (block.type === 'list') {
      const list = document.createElement(block.style === 'ordered' ? 'ol' : 'ul')
      for (const [index, item] of block.items.entries()) {
        const line = document.createElement('li')
        writeText(line, item, block.itemRuns?.[index])
        list.append(line)
      }
      root.append(list)
      continue
    }
    if (block.type === 'quote') {
      const quote = document.createElement('blockquote')
      const line = document.createElement('p')
      writeText(line, block.text, block.runs)
      quote.append(line)
      const attribution = document.createElement('cite')
      attribution.dataset.placeholder = 'Attribution (optional)'
      attribution.textContent = block.attribution ?? ''
      quote.append(attribution)
      root.append(quote)
      continue
    }
    const element = document.createElement(block.type === 'heading' ? `h${block.level}` : 'p')
    writeText(element, block.text, block.runs)
    root.append(element)
  }
}

export function readJournalDocument(root: HTMLElement): JournalBlock[] {
  const blocks: JournalBlock[] = []
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) blocks.push({ type: 'paragraph', text: node.textContent })
      continue
    }
    if (!(node instanceof HTMLElement)) continue
    const tag = node.tagName.toLowerCase()
    if (tag === 'figure' && node.dataset.imageId) {
      const width = Number(node.dataset.widthPercent)
      blocks.push({
        type: 'image',
        imageId: node.dataset.imageId,
        caption: node.querySelector('figcaption')?.textContent ?? '',
        ...(Number.isFinite(width) && width < 100 ? { widthPercent: Math.min(100, Math.max(25, width)) } : {}),
        ...(node.dataset.align === 'left' || node.dataset.align === 'right' ? { alignment: node.dataset.align } : {}),
      })
    } else if (tag === 'ul' || tag === 'ol') {
      const lines = Array.from(node.children).filter((child): child is HTMLLIElement => child.tagName === 'LI')
      const values = lines.map(textValue)
      blocks.push({
        type: 'list', style: tag === 'ol' ? 'ordered' : 'unordered',
        items: values.map((value) => value.text),
        itemRuns: values.some((value) => value.runs) ? values.map((value) => value.runs ?? [{ text: value.text }]) : undefined,
      })
    } else if (tag === 'blockquote') {
      const line = node.querySelector('p') ?? node
      const value = textValue(line)
      blocks.push({ type: 'quote', ...value, attribution: node.querySelector('cite')?.textContent ?? '' })
    } else if (tag === 'h2' || tag === 'h3') {
      blocks.push({ type: 'heading', level: tag === 'h2' ? 2 : 3, ...textValue(node) })
    } else if (tag === 'p' || tag === 'div') {
      blocks.push({ type: 'paragraph', ...textValue(node) })
    } else if (tag === 'br') {
      blocks.push({ type: 'paragraph', text: '' })
    } else {
      blocks.push({ type: 'paragraph', ...textValue(node) })
    }
  }
  return blocks
}
