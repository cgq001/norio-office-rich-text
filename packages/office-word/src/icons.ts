const monoIconModules = import.meta.glob('./assets/icons/mono/*.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const colorIconModules = import.meta.glob('./assets/icons/color/*.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
})

function toIconMap(modules: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(modules).map(([path, svg]) => {
      const name = path.split('/').pop()?.replace(/\.svg$/i, '') ?? path
      return [name, String(svg)]
    }),
  )
}

export const monoIcons = toIconMap(monoIconModules)
export const colorIcons = toIconMap(colorIconModules)

export const monoIconNames = Object.keys(monoIcons).sort()
export const colorIconNames = Object.keys(colorIcons).sort()
