import { Extension, type CommandProps } from '@tiptap/core'

type TextAlignValue = 'left' | 'center' | 'right'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (alignment: TextAlignValue) => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}

export const TextAlign = Extension.create({
  name: 'textAlign',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      alignments: ['left', 'center', 'right'] as TextAlignValue[],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.style.textAlign || element.getAttribute('data-text-align')
              return this.options.alignments.includes(value) ? value : null
            },
            renderHTML: (attributes: { textAlign?: TextAlignValue | null }) => {
              if (!attributes.textAlign || attributes.textAlign === 'left') {
                return {}
              }

              return {
                'data-text-align': attributes.textAlign,
                style: `text-align: ${attributes.textAlign};`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const updateAlignment = (alignment: TextAlignValue | null) => ({ state, dispatch }: CommandProps) => {
      const { selection, doc } = state
      let tr = state.tr
      let changed = false

      doc.nodesBetween(selection.from, selection.to, (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => {
        if (!this.options.types.includes(node.type.name)) {
          return
        }

        const nextAlign = alignment === 'left' ? null : alignment
        if (node.attrs.textAlign === nextAlign) {
          return false
        }

        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          textAlign: nextAlign,
        })
        changed = true
        return false
      })

      if (!changed) {
        const { $from } = selection
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth)
          if (!this.options.types.includes(node.type.name)) {
            continue
          }

          tr = tr.setNodeMarkup($from.before(depth), undefined, {
            ...node.attrs,
            textAlign: alignment === 'left' ? null : alignment,
          })
          changed = true
          break
        }
      }

      if (!changed) {
        return false
      }

      if (dispatch) {
        dispatch(tr)
      }

      return true
    }

    return {
      setTextAlign:
        (alignment: TextAlignValue) =>
        (props: CommandProps) =>
          updateAlignment(alignment)(props),
      unsetTextAlign:
        () =>
        (props: CommandProps) =>
          updateAlignment(null)(props),
    }
  },
})
