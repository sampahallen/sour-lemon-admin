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
  figure.contentEditable = 'false'
  if (image) {
    const photo = document.createElement('img')
    photo.src = image.url
    photo.alt = image.altText
    figure.append(photo)
  } else {
    const unavailable = document.createElement('div')
    unavailable.className = 'journal-document-image-missing'
    unavailable.textContent = 'Photo unavailable'
    figure.append(unavailable)
  }
  const caption = document.createElement('figcaption')
  caption.dataset.placeholder = 'Add a caption…'
  caption.contentEditable = 'true'
  caption.textContent = block.caption ?? ''
  figure.append(caption)
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.dataset.removeImage = block.imageId
  remove.setAttribute('aria-label', 'Remove photo')
  remove.textContent = 'Remove photo'
  figure.append(remove)
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
      blocks.push({ type: 'image', imageId: node.dataset.imageId, caption: node.querySelector('figcaption')?.textContent ?? '' })
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
