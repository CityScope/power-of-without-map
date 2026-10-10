# Architecture

Power of Without Map is a Next.js App Router application. The interface, route handlers, and SQLite database run together in one project. There is no separate backend service and no authentication layer.

## Frontend

Pages live in `src/app`. Interactive views are client components under `src/components`.

| Route | Role |
| --- | --- |
| `/` and `/map` | Main Leaflet map |
| `/add-settlement` | Eight-step contribution wizard |
| `/edit-settlement/[id]` | Edit an existing settlement |
| `/settlements/[id]` | Settlement profile |
| `/settlements/[id]/summary` | Shorter summary |
| `/methodology` | Implemented methodology |
| `/analytics` | Informality observatory |
| `/data-import` | Data source manager |
| `/data-sources` | Static source list |
| `/export` | Export center |
| `/admin` | Review workspace |

The global header is `AppNav`. It is not an access-control boundary.

The map uses Leaflet through React Leaflet. Settlement polygons and centroid bubbles are built in the browser by `buildSettlementMapLayerModel`. Bubble radius is computed in `settlementMapBubble.ts` from area, with the score drawn as an inner core. Drawing uses Leaflet.draw. Area and centroid helpers use Turf in `src/lib/geo.ts`.

## Backend and API

Route handlers in `src/app/api` read and write Prisma models. They return JSON or export files. None of them check a session, cookie, or API key.

That includes settlement create, update, and delete, score persistence, imports, exports, analytics, and admin review.

## Data model

Prisma schema: `prisma/schema.prisma`. Provider: SQLite via `DATABASE_URL`.

| Model | Role |
| --- | --- |
| `Settlement` | Name, place, GeoJSON geometry and centroid as strings, area, population, source, `atlasReference`, `verificationStatus`, reviewer notes |
| `SurveyResponse` | Questionnaire JSON for one submission |
| `CalculatedScore` | Dimension scores, headline score, completeness, uncertainty, missing variables, formula versions |
| `OpenDataEnrichment` | OSM and suggestion payloads, accept/reject keys |
| `AuditLog` | Per-settlement action history, including review changes |
| `ContextualIndicator` | Country-level indicator rows. Not settlement geometry |

`verificationStatus` values used by the app are `draft`, `submitted`, `reviewed`, `verified`, and `rejected`.

`atlasReference: true` marks an Atlas reference record. Community records use `false`.

## Geographic data

Geometry is stored as a GeoJSON string on `Settlement.geometry`. The centroid is stored as a GeoJSON point string. `areaM2` is calculated with Turf when a settlement is created or updated through the settlement API.

The map list endpoint returns geometry and centroid. It does not return `areaM2`. The map measures area from the polygon when it sizes bubbles.

Country shapes for the UN-Habitat layer come from `public/geo/countries.geo.json`. They are not settlement boundaries. That file stays on a local machine and is not part of the published repository. See [DATA_SOURCES.md](DATA_SOURCES.md).

## Scoring flow

1. The wizard or settlement API collects answers.
2. `calculateInformalityScore` builds dimension scores and the headline score.
3. Missing inputs are omitted. Weights of the remaining inputs are renormalized.
4. `computeAndPersistScore` writes a `CalculatedScore` row with versions, completeness, and uncertainty.
5. Analytics reads stored scores. It does not recalculate them and does not turn nulls into zeros.

## How data moves

```text
Atlas of Informality (ArcGIS)
  → POST /api/data-sources/atlas-arcgis-discover
  → Settlement rows with atlasReference = true
  → map

UN-Habitat / HDX CSV
  → POST /api/import/hdx-unhabitat
  → ContextualIndicator rows
  → national context on the map and in analytics

Community questionnaire
  → POST /api/settlements or PUT /api/settlements/[id]
  → Settlement + SurveyResponse + CalculatedScore
  → map, analytics, and admin review
```

Admin review updates `verificationStatus` and `reviewerNotes` and appends an audit row. It does not recalculate the score.

Import and export do not change the scoring formulas.

## Access control

There is no authentication or authorization.

Anyone who can reach the server can read settlements, export them, import data, change review status, and delete community settlements. Atlas reference rows are refused by the delete handler (`403`). That is the only special write restriction.

Do not deploy this application on a public network with a real database until access control is added. Publishing the source code is a separate decision from exposing a running server.
