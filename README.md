# office-word workspace

This repository now uses a standard component-library layout:

- `packages/office-word`: publishable npm package `@norio-office/rich-text`
- `playground`: local preview app used during development

## Scripts

- `npm run dev`: start the playground
- `npm run build`: build the publishable component package
- `npm run build:playground`: build the preview app
- `npm run build:all`: build both package and playground
- `npm run typecheck`: run type checks for both workspaces
- `npm run preview`: preview the built playground

## Docs

- component usage guide: `docs/usage.md`
- public instance api notes: `docs/external-api.md`
