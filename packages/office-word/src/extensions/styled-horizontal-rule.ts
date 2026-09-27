import HorizontalRule from '@tiptap/extension-horizontal-rule'

import { normalizeDividerColor, normalizeDividerStyle } from '../utils/divider'

export const StyledHorizontalRule = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      lineStyle: {
        default: 'solid',
        parseHTML: element => normalizeDividerStyle(element.getAttribute('data-line-style') || element.style.borderTopStyle),
        renderHTML: attributes => {
          const style = normalizeDividerStyle(attributes.lineStyle)
          return {
            'data-line-style': style,
            style: `border-top-style: ${style}; border-top-width: ${style === 'solid' ? 1 : 2}px;`,
          }
        },
      },
      lineColor: {
        default: null,
        parseHTML: element => normalizeDividerColor(element.getAttribute('data-line-color')),
        renderHTML: attributes => {
          const color = normalizeDividerColor(attributes.lineColor)
          return color ? { 'data-line-color': color, style: `border-top-color: ${color};` } : {}
        },
      },
    }
  },
})
