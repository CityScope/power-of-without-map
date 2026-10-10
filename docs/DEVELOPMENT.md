# Local development

## Prerequisites

- Node.js 20 (this repository was developed on Node.js 20.19)
- npm
- Git

No hosted database is required. Prisma uses a local SQLite file.

## Setup

From `power-of-without-map`:

```bash
npm install
cp .env.example .env
npx prisma generate
npm run db:push
npm run dev
```

The app serves `http://localhost:3000`. Use `localhost` rather than another host name if the browser blocks hot-reload assets.

## Environment

Copy `.env.example` to `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLite URL. Default `file:./dev.db`, resolved by Prisma under `prisma/`. |
| `NEXT_PUBLIC_BASE_URL` | No | Listed in `.env.example` for a local origin. Application code does not read it. |
| `NEXT_PUBLIC_THUNDERFOREST_API_KEY` | No | Cycle-map tiles. Empty uses standard OpenStreetMap tiles. |
| `NEXT_PUBLIC_SHOW_ATLAS_DEBUG` | No | Development-only map debug overlay when set to `true`. |
| `HDX_HAPI_APP_IDENTIFIER` | No | Optional HDX HAPI header. Omitted when empty. |

Do not commit `.env` or `prisma/dev.db`.

## Prisma

This project applies the schema with `db push`. There is no `prisma/migrations` history.

```bash
npm run db:generate   # prisma generate
npm run db:push       # create or update the local SQLite schema
npm run db:studio     # optional Prisma Studio
```

## Scripts

```bash
npm run dev
npm test
npm run lint
npm run build
npm start
npm run seed
```

Import scripts in `package.json` (`import:atlas`, `import:geojson`, `import:kml`, `import:shp`, `import:unhabitat`, `reimport:atlas`) call the local `scripts/` folder. They write to the database. Read the script before running one.

## Checks

```bash
npm test
npm run lint
npm run build
```

`npm run build` is the type check used by this project. `tsconfig.json` has `noEmit: true`. `next-env.d.ts` is gitignored and is created by Next during development or build.

Vitest configuration is `vitest.config.ts`. Tests live in `src/lib/*.test.ts` and `src/tests/`.

## Troubleshooting

- **Port 3000 is already in use.** Another `next dev` is running. Use that server, or stop it before starting a second one.
- **Prisma client errors after a schema read.** Run `npx prisma generate` again. Do not edit generated client files.
- **Empty map.** The database has no settlements until data is imported or seeded. Seed data is illustrative.
- **National choropleth is missing after a clone.** `public/geo/countries.geo.json` is not in Git. Settlement polygons still draw. The country layer needs that local file. See [DATA_SOURCES.md](DATA_SOURCES.md).
- **Cycle map does not appear.** `NEXT_PUBLIC_THUNDERFOREST_API_KEY` is empty. The map uses OpenStreetMap tiles instead.
- **HDX test needs a network.** The connection check calls HDX. It does not write rows. The import route does write rows.

## What not to commit

- `.env`
- `prisma/dev.db` and its journal
- `node_modules`
- `.next`
- export files downloaded during manual testing
- database copies that contain community contributions
