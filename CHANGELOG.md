# Changelog

## Milestone 0: project setup

- TypeScript, Vite, Vitest, ESLint (flat config) and Prettier.
- ESLint guards the simulation's purity: no `Math.random`, clock or browser globals in `src/sim`.
- GitHub Actions CI runs typecheck, lint, format check, tests and a production build.
- A blank page renders with the paper palette.
