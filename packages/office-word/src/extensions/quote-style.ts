import { Extension } from '@tiptap/core'

type QuoteStyleOptions = {
  defaultBorderColor: string
  defaultBackgroundColor: string
}

type QuoteStyleAttrs = {
  quoteBorderColor?: string
  quoteBackgroundColor?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    quoteStyle: {
      setQuoteStyle: (attributes: QuoteStyleAttrs) => ReturnType
      resetQuoteStyle: () => ReturnType
    }
  }
}

export const QuoteStyle = Extension.create<QuoteStyleOptions>({
  name: 'quoteStyle',

  addOptions() {
    return {
      defaultBorderColor: '#c084fc',
      defaultBackgroundColor: '#fcf5ff',
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['blockquote'],
        attributes: {
          quoteBorderColor: {
            default: this.options.defaultBorderColor,
            parseHTML: (element) => element.getAttribute('data-quote-border-color') || this.options.defaultBorderColor,
            renderHTML: (attributes) => {
              const borderColor = attributes.quoteBorderColor || this.options.defaultBorderColor
              const backgroundColor = attributes.quoteBackgroundColor || this.options.defaultBackgroundColor

              return {
                'data-quote-border-color': borderColor,
                'data-quote-background-color': backgroundColor,
                style: `--norio-office-rich-quote-border-color:${borderColor};--norio-office-rich-quote-background-color:${backgroundColor};`,
              }
            },
          },
          quoteBackgroundColor: {
            default: this.options.defaultBackgroundColor,
            parseHTML: (element) =>
              element.getAttribute('data-quote-background-color') || this.options.defaultBackgroundColor,
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setQuoteStyle:
        (attributes) =>
        ({ commands }) =>
          commands.updateAttributes('blockquote', {
            quoteBorderColor: attributes.quoteBorderColor ?? this.options.defaultBorderColor,
            quoteBackgroundColor: attributes.quoteBackgroundColor ?? this.options.defaultBackgroundColor,
          }),
      resetQuoteStyle:
        () =>
        ({ commands }) =>
          commands.updateAttributes('blockquote', {
            quoteBorderColor: this.options.defaultBorderColor,
            quoteBackgroundColor: this.options.defaultBackgroundColor,
          }),
    }
  },
})
