import { Table, TableView } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { getTableThemeHTMLAttributes, normalizeTableTheme } from '../utils/table-theme'

class ThemedTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    this.updateTheme(node)
  }

  update(node: ProseMirrorNode) {
    const previousTheme = this.node.attrs.tableTheme
    if (!super.update(node)) return false
    if (previousTheme !== node.attrs.tableTheme) this.updateTheme(node)
    return true
  }

  private updateTheme(node: ProseMirrorNode) {
    const attributes = getTableThemeHTMLAttributes(node.attrs.tableTheme)
    for (const key of ['data-table-theme', 'data-table-theme-header', 'data-table-theme-odd', 'data-table-theme-even']) {
      if (attributes[key]) this.table.setAttribute(key, attributes[key])
      else this.table.removeAttribute(key)
    }
    for (const key of ['header', 'header-text', 'odd', 'even']) {
      this.table.style.removeProperty(`--norio-office-rich-table-${key}`)
    }
    if (attributes.style) this.table.style.cssText += attributes.style
  }
}

export const ThemedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableTheme: {
        default: null,
        parseHTML: element => normalizeTableTheme({
          header: element.getAttribute('data-table-theme-header'),
          odd: element.getAttribute('data-table-theme-odd'),
          even: element.getAttribute('data-table-theme-even'),
        }),
        renderHTML: attributes => getTableThemeHTMLAttributes(attributes.tableTheme),
      },
    }
  },
}).configure({ View: ThemedTableView })
