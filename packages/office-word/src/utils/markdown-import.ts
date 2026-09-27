import type { JSONContent } from '@tiptap/core'
import { marked } from 'marked'
import { normalizeWebUrl, sanitizeImageUrl } from './url'

type Mark = NonNullable<JSONContent['marks']>[number]

function createImportAssetId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isBlankTextNode(node: Node) {
  return node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()
}

function hasOnlyWhitespaceText(nodes: Node[]) {
  return nodes.every((node) => isBlankTextNode(node))
}

function cloneMarks(marks: Mark[]) {
  return marks.map((mark) => ({
    type: mark.type,
    attrs: mark.attrs ? { ...mark.attrs } : undefined,
  }))
}

function textNode(text: string, marks: Mark[] = []): JSONContent | null {
  if (!text) {
    return null
  }

  return {
    type: 'text',
    text,
    ...(marks.length ? { marks: cloneMarks(marks) } : {}),
  }
}

function parseInlineNodes(nodes: Node[], marks: Mark[] = []): JSONContent[] {
  const result: JSONContent[] = []

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      if (value) {
        const next = textNode(value, marks)
        if (next) {
          result.push(next)
        }
      }
      return
    }

    if (!(node instanceof HTMLElement)) {
      return
    }

    const tag = node.tagName.toLowerCase()
    if (tag === 'br') {
      result.push({ type: 'hardBreak' })
      return
    }

    if (tag === 'strong' || tag === 'b') {
      result.push(...parseInlineNodes(Array.from(node.childNodes), [...marks, { type: 'bold' }]))
      return
    }

    if (tag === 'em' || tag === 'i') {
      result.push(...parseInlineNodes(Array.from(node.childNodes), [...marks, { type: 'italic' }]))
      return
    }

    if (tag === 'code') {
      const next = textNode(node.textContent ?? '', [...marks, { type: 'code' }])
      if (next) {
        result.push(next)
      }
      return
    }

    if (tag === 'a') {
      const label = node.textContent?.trim() || node.getAttribute('href') || ''
      const href = node.getAttribute('href') || ''
      const display = href && href !== label ? `${label} (${href})` : label
      const next = textNode(display, marks)
      if (next) {
        result.push(next)
      }
      return
    }

    if (tag === 'img') {
      const alt = node.getAttribute('alt') || node.getAttribute('src') || ''
      const next = textNode(alt ? `[图片: ${alt}]` : '[图片]', marks)
      if (next) {
        result.push(next)
      }
      return
    }

    result.push(...parseInlineNodes(Array.from(node.childNodes), marks))
  })

  return result
}

function buildImageBlock(element: HTMLElement): JSONContent | null {
  const src = sanitizeImageUrl(element.getAttribute('src') || '')
  if (!src) {
    return null
  }

  const alt = element.getAttribute('alt')?.trim() || ''
  return {
    type: 'imageBlock',
    attrs: {
      images: [
        {
          id: createImportAssetId('image'),
          src,
          alt,
          name: alt || 'Markdown image',
          description: '',
          link: '',
          rotation: 0,
        },
      ],
      widthPercent: 100,
      align: 'left',
      height: 146,
    },
  }
}

function buildLinkBlock(element: HTMLElement): JSONContent | null {
  const href = normalizeWebUrl(element.getAttribute('href') || '')
  if (!href) {
    return null
  }

  const title = element.textContent?.trim() || href
  return {
    type: 'linkBlock',
    attrs: {
      title,
      url: href,
      displayMode: 'text',
      align: 'left',
      widthPercent: 100,
      height: 420,
    },
  }
}

function buildParagraphContent(element: HTMLElement): JSONContent | null {
  const meaningfulNodes = Array.from(element.childNodes).filter((node) => !isBlankTextNode(node))

  if (meaningfulNodes.length === 1 && meaningfulNodes[0] instanceof HTMLElement) {
    const onlyChild = meaningfulNodes[0]
    const tag = onlyChild.tagName.toLowerCase()
    if (tag === 'img') {
      return buildImageBlock(onlyChild)
    }

    if (tag === 'a') {
      return buildLinkBlock(onlyChild)
    }
  }

  const content = parseInlineNodes(Array.from(element.childNodes))
  if (!content.length) {
    return null
  }

  return {
    type: 'paragraph',
    content,
  }
}

function buildListItem(element: HTMLElement): JSONContent {
  const content: JSONContent[] = []
  const inlineBucket: Node[] = []

  Array.from(element.childNodes).forEach((node) => {
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') {
        if (!hasOnlyWhitespaceText(inlineBucket)) {
          const paragraphContent = parseInlineNodes(inlineBucket)
          if (paragraphContent.length) {
            content.push({ type: 'paragraph', content: paragraphContent })
          }
          inlineBucket.length = 0
        }

        const nestedList = buildBlockNode(node)
        if (nestedList) {
          content.push(nestedList)
        }
        return
      }

      if (tag === 'p' || tag === 'blockquote' || tag === 'pre' || tag === 'hr') {
        if (!hasOnlyWhitespaceText(inlineBucket)) {
          const paragraphContent = parseInlineNodes(inlineBucket)
          if (paragraphContent.length) {
            content.push({ type: 'paragraph', content: paragraphContent })
          }
          inlineBucket.length = 0
        }

        const block = buildBlockNode(node)
        if (block) {
          content.push(block)
        }
        return
      }
    }

    inlineBucket.push(node)
  })

  if (!hasOnlyWhitespaceText(inlineBucket)) {
    const paragraphContent = parseInlineNodes(inlineBucket)
    if (paragraphContent.length) {
      content.push({ type: 'paragraph', content: paragraphContent })
    }
  }

  if (!content.length) {
    content.push({ type: 'paragraph' })
  }

  return {
    type: 'listItem',
    content,
  }
}

function buildList(element: HTMLElement, ordered: boolean): JSONContent | null {
  const items = Array.from(element.children)
    .filter((child): child is HTMLElement => child.tagName.toLowerCase() === 'li')
    .map((child) => buildListItem(child))

  if (!items.length) {
    return null
  }

  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: items,
  }
}

function buildCodeBlock(element: HTMLElement): JSONContent | null {
  const codeElement = element.querySelector('code')
  const code = codeElement?.textContent ?? element.textContent ?? ''
  if (!code.trim()) {
    return null
  }

  const className = codeElement?.className || ''
  const languageMatch = className.match(/language-([a-z0-9_-]+)/i)
  const language = languageMatch?.[1]?.toLowerCase() || 'plain_text'

  if (language === 'mermaid' || language === 'plantuml' || language === 'markmap' || language === 'flowchart') {
    return null
  }

  return {
    type: 'codeBlock',
    attrs: {
      language,
      wrapLines: false,
      darkTheme: false,
      fixedHeight: false,
    },
    content: [{ type: 'text', text: code.replace(/\n$/, '') }],
  }
}

function buildBlockquote(element: HTMLElement): JSONContent | null {
  const content = buildBlockNodes(Array.from(element.childNodes))
  if (!content.length) {
    return null
  }

  return {
    type: 'blockquote',
    content,
  }
}

function buildHeading(element: HTMLElement): JSONContent | null {
  const content = parseInlineNodes(Array.from(element.childNodes))
  const level = Number.parseInt(element.tagName.replace(/[^0-9]/g, ''), 10)
  if (!content.length || Number.isNaN(level)) {
    return null
  }

  return {
    type: 'heading',
    attrs: { level },
    content,
  }
}

function buildBlockNode(node: Node): JSONContent | null {
  if (!(node instanceof HTMLElement)) {
    return null
  }

  const tag = node.tagName.toLowerCase()

  if (tag === 'p') {
    return buildParagraphContent(node)
  }

  if (/^h[1-6]$/.test(tag)) {
    return buildHeading(node)
  }

  if (tag === 'blockquote') {
    return buildBlockquote(node)
  }

  if (tag === 'ul') {
    return buildList(node, false)
  }

  if (tag === 'ol') {
    return buildList(node, true)
  }

  if (tag === 'pre') {
    return buildCodeBlock(node)
  }

  if (tag === 'hr') {
    return { type: 'horizontalRule' }
  }

  if (tag === 'img') {
    return buildImageBlock(node)
  }

  if (tag === 'a') {
    return buildLinkBlock(node)
  }

  return null
}

function buildBlockNodes(nodes: Node[]): JSONContent[] {
  return nodes
    .map((node) => buildBlockNode(node))
    .filter((node): node is JSONContent => !!node)
}

export function parseMarkdownToContent(markdown: string): JSONContent[] {
  const html = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string

  const document = new DOMParser().parseFromString(`<div data-markdown-root="true">${html}</div>`, 'text/html')
  const root = document.querySelector('[data-markdown-root="true"]')
  if (!root) {
    return [{ type: 'paragraph' }]
  }

  const content = buildBlockNodes(Array.from(root.childNodes))
  return content.length ? content : [{ type: 'paragraph' }]
}
