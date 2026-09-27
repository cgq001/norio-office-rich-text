import { Extension, type CommandProps } from '@tiptap/core'

type IndentOptions = {
  types: string[]
  minLevel: number
  maxLevel: number
  stepEm: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType
      decreaseIndent: () => ReturnType
    }
  }
}

function clampIndent(value: number, minLevel: number, maxLevel: number) {
  return Math.max(minLevel, Math.min(maxLevel, value))
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 8,
      stepEm: 2,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const value = element.getAttribute('data-indent')
              const parsed = Number.parseInt(value ?? '0', 10)
              return Number.isNaN(parsed)
                ? this.options.minLevel
                : clampIndent(parsed, this.options.minLevel, this.options.maxLevel)
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent ?? 0)

              if (!indent) {
                return {}
              }

              return {
                'data-indent': String(indent),
                style: `margin-left: ${indent * this.options.stepEm}em;`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const updateIndent = (delta: number) => ({ state, dispatch }: CommandProps) => {
      const tr = state.tr
      let changed = false
      const visited = new Set<number>()

      // Cell selections have a separate range for each selected cell.
      for (const { $from, $to } of state.selection.ranges) {
        state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
          if (!this.options.types.includes(node.type.name) || visited.has(pos)) {
            return
          }
          visited.add(pos)

          const currentIndent = Number(node.attrs.indent ?? 0)
          const nextIndent = clampIndent(currentIndent + delta, this.options.minLevel, this.options.maxLevel)

          if (nextIndent === currentIndent) {
            return
          }

          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            indent: nextIndent,
          })
          changed = true
        })
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
      increaseIndent: () => updateIndent(1),
      decreaseIndent: () => updateIndent(-1),
    }
  },
})
