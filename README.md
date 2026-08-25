# sour-lemon-admin

Admin dashboard for the Sour Lemon site. React 19 + TypeScript + Vite + Tailwind CSS v4.

## Commands

- `npm run dev` — start the Vite dev server (HMR)
- `npm run build` — type-check (`tsc -b`) then production-build via Vite
- `npm run lint` — run oxlint
- `npm run preview` — serve the production build locally

## Conventions

Mirrors [`sour-lemon-frontend`](../sour-lemon-frontend): `@/*` resolves to `src/*`, and brand tokens
(`cream`, `butter`, `flame`, `cocoa`, `olive`, `sand`, `--font-display`, `--font-body`,
`--shadow-chunky`) are defined in `src/index.css` under Tailwind v4's `@theme`.
