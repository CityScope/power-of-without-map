# Contributing

Thanks for helping document and improve Power of Without Map. This is a research application. Clarity of method matters as much as the interface.

## Install

Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```bash
npm install
cp .env.example .env
npx prisma generate
npm run db:push
npm test
```

## Branches

Create a branch from `main` for each change.

```bash
git checkout -b short-topic-name
```

Do not commit `.env`, `prisma/dev.db`, or exported files that contain contributed settlement records.

## Conventions

- TypeScript and the existing App Router layout.
- Keep user-facing copy in the component or the methodology copy module that already owns it.
- Match the current visual language when changing the interface: dark background, white text, amber for primary numbers and actions, violet for completeness.
- Prefer the existing scoring, import, and export functions over a second implementation.
- A missing score is null. Do not coerce it to zero.

## Scientific methodology

Do not change weights, normalization, or the headline formula unless the change is intentional, reviewed, and reflected in `docs/METHODOLOGY.md` and the methodology page.

The headline score is `0.5 × Architecture + 0.5 × Populace`. Site stays contextual.

The 2022 taxonomy preprint and this software are related and not identical. Document the difference if you change an operational rule.

## Data and privacy

- Atlas geometries, HDX tables, and community profiles have different sources and different redistribution questions.
- Do not add a dataset license, DOI, or institutional endorsement that is not already established.
- Do not commit private notes, precise unpublished community boundaries, or the local SQLite database.
- National UN-Habitat figures must stay separate from settlement scores.

## Tests

Before a pull request:

```bash
npm test
npm run lint
npm run build
```

Add or update a unit test when you change a pure function in `src/lib`. Do not run a live Atlas import, HDX import, approval, or rejection just to see the button work.

## Pull requests

Describe why the change is needed, which routes or documents it touches, and how you tested it. If you did not run a workflow, say so.

## Issues

Report the route, what you expected, and what happened. Include the Node.js version. Do not paste secrets, `.env` values, or private community notes.
