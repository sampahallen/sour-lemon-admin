import type { JournalBlock } from '@/api/journal'

export const JOURNAL_BLOCK_LABELS: Record<JournalBlock['type'], string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  list: 'List',
  quote: 'Quote',
  image: 'Image',
}

export function createEmptyBlock(type: JournalBlock['type']): JournalBlock {
  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', text: '' }
    case 'heading':
      return { type: 'heading', level: 2, text: '' }
    case 'list':
      return { type: 'list', style: 'unordered', items: [''] }
    case 'quote':
      return { type: 'quote', text: '', attribution: '' }
    case 'image':
      return { type: 'image', imageId: '', caption: '' }
  }
}
