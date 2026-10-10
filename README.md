# Power of Without Map

Atlas of Informal Settlements

## Overview

Power of Without Map is an interactive research platform for documenting, exploring, and comparing informal settlements. It combines geographic boundaries, community-contributed profiles, and a multidimensional informality score.

The platform is developed in the context of the MIT Media Lab City Science research project [The Power of Without](https://www.media.mit.edu/projects/power-of-without-1/overview/). The scoring questionnaire is grounded in the 2022 research preprint *Taxonomy of Informality*. The software implementation is documented separately from that preprint, because some operational choices differ from the paper.

## Research objectives

- Map informal settlements with geographic boundaries and a readable overview at broader scales.
- Support community-contributed settlement profiles.
- Describe informality as more than one dimension.
- Compare settlements with indicators whose weights and missing-data rules are explicit.
- Keep research methods and geographic information inspectable.
- Support evidence-informed urban research and discussion.

The score is a discussion aid. It does not replace local knowledge.

## Main features

1. **Interactive settlement map.** Polygons show settlement area. Bubbles scale with area. An inner core reflects a stored Informality Score when one exists.
2. **Atlas reference settlements.** Records imported from the Atlas of Informality are marked `atlasReference` and drawn in amber.
3. **Community-contributed profiles.** Records that are not atlas references are drawn in green.
4. **Boundary drawing and editing.** The map can draw a polygon. Existing boundaries can be edited on the settlement edit page.
5. **Eight-step Add Settlement workflow.** Location, basic information, infrastructure, housing and density, people and livelihoods, health and education, site and community voice, then review.
6. **Informality Score.** Headline score = `0.5 × Architecture + 0.5 × Populace`, on a 0–1 scale. A missing score stays missing. It is not stored as zero.
7. **Architecture, Populace, and contextual Site.** Site is calculated and shown. It is not included in the headline score.
8. **Analytics.** Score distribution, completeness, geography, and settlement comparison. Records without a stored score are kept out of score averages.
9. **UN-Habitat national context.** Country-level SDG 11.1.1 indicators from HDX can be shown beside settlement data. They are not settlement scores.
10. **Data import.** Atlas ArcGIS discovery imports exposed records. UN-Habitat / HDX import writes national indicators. A connection test does not write records.
11. **Data export.** GeoJSON, CSV, KML, Shapefile ZIP, and DXF. DWG is documented as unsupported by the current exporter.
12. **Administrative review.** Status can be set to submitted, reviewed, verified, or rejected, with reviewer notes saved on that change.

There is no user login. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technology stack

Versions below are the ranges or pins in `package.json` at the time of this document.

| Layer | Technology |
| --- | --- |
| Application | Next.js 16.2.4 (App Router), React 19.2.4, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Map | Leaflet 1.9.4, React Leaflet 5, Leaflet.draw |
| Charts | Recharts 3 |
| Database | Prisma 6.7 with SQLite |
| Validation | Zod 4 |
| Geometry | Turf.js 7 |
| Tests | Vitest 4 |
| Lint | ESLint 9 |

## Installation

Requirements: Node.js 20 and npm.

```bash
git clone <repository-url>
cd power-of-without-map
npm install
cp .env.example .env
npx prisma generate
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

`npm run db:push` creates the local SQLite schema. This project does not use Prisma Migrate history.

Optional demo records:

```bash
npm run seed
```

Seed records are illustrative. They are not verified local observations.

Other commands:

```bash
npm test
npm run lint
npm run build
npm start
```

Details: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Project structure

```text
src/app/            routes and API handlers
src/components/     map, wizard, analytics, import, export, admin
src/lib/            scoring, imports, exports, map helpers
prisma/schema.prisma
docs/               methodology, architecture, data, API, development
scripts/            local import and seed scripts
data/               illustrative seed sample
public/geo/         country boundaries for the national context layer
```

## Data sources

Three kinds of information stay separate.

- **Atlas reference settlements** are geographic records associated with the [Atlas of Informality](https://www.atlasofinformality.com/). They are reference geometries, not completed community questionnaires.
- **Community-contributed records** are profiles created in this application, including questionnaire answers and a calculated score when enough answers exist.
- **UN-Habitat / HDX indicators** are national figures for SDG 11.1.1. They describe countries, not settlement boundaries, and they are not combined into the Informality Score.

More detail: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Methodology

The implemented score, weights, missing-data rule, and limitations are in [docs/METHODOLOGY.md](docs/METHODOLOGY.md). The in-app explanation is at `/methodology`.

Operational source of truth:

- `src/lib/informalityCalculator.ts`
- `src/lib/normalization.ts`
- `src/lib/scoringPipeline.ts`

## Research references

Wang, Xinran; Iruretagoyena, Maitane; Alonso Pastor, Luis; Larson, Kent. 2022. *Taxonomy of Informality: Methodology for Establishing Multi-dimension Global Informal Indicators to be Used on the Informality Crowd-sourced Database.* Research preprint. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4149958

MIT Media Lab, City Science. *The Power of Without.* https://www.media.mit.edu/projects/power-of-without-1/overview/

Research authors: Xinran Wang, Maitane Iruretagoyena, Luis Alonso Pastor, and Kent Larson.

## Development and contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Changes to scores, weights, or normalization need to stay aligned with `informalityCalculator.ts` and the methodology page. Do not treat a blank answer as zero.

## License

No software license has been approved for this repository. Do not assume an MIT license, an open-source grant, or permission to redistribute imported datasets. Dataset terms, the research preprint, and any future software license are separate decisions.
