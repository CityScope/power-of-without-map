# API

All routes below are implemented in `src/app/api`. None of them require authentication. Treat that as a deployment constraint, not as a public data license.

Errors are JSON unless noted. A missing settlement returns `404` with `{ "error": "Not found" }` on the routes that look up an id.

## Settlements

### `GET /api/settlements`

Map list. Returns an array of settlements with `id`, `name`, `country`, `city`, `geometry`, `centroid`, `atlasReference`, `verificationStatus`, and `calculatedScores`.

Community rows include the latest `finalInformalityScore` when a score row exists. The list does not include `areaM2` or questionnaire answers. Missing scores are omitted or null. They are not returned as zero.

### `POST /api/settlements`

Creates a settlement from the shared settlement input schema (`src/lib/schemas.ts`): name, geometry, optional place and population fields, source, verification status, and answers.

The handler computes area and centroid, stores a survey response, and persists a score. Invalid input returns `400` with Zod flatten output.

### `GET /api/settlements/[id]`

Full settlement, including the latest score, latest survey response, enrichments, and the latest 20 audit log rows. `atlasReference` is always present as a boolean.

### `PUT /api/settlements/[id]`

Same input schema as create. Replaces editable settlement fields, appends a survey response and an audit row, and recalculates the stored score. Invalid input returns `400`.

### `DELETE /api/settlements/[id]`

Deletes a community settlement. Atlas reference rows return `403` with an error message and are not deleted.

### `POST /api/settlements/[id]/enrich`

Runs open-data enrichment for the settlement and stores suggestions. This does not by itself change questionnaire answers.

### `POST /api/settlements/[id]/apply-suggestions`

Body includes `acceptedKeys` and `rejectedKeys`. Records which suggested values were accepted or rejected.

## Scores

Scores are not a separate collection endpoint. They are written when a settlement is created or updated, and they are returned on settlement and analytics responses.

The headline field is `finalInformalityScore`. Related fields include dimension scores, `completenessScore`, `uncertaintyScore`, `missingVariablesJson`, and formula version fields. Null means the value was not calculated.

## Analytics

### `GET /api/analytics`

Returns `{ settlements, nationalIndicators }`.

Each settlement observation includes identifiers, place, `atlasReference`, `verificationStatus`, and score fields. Missing numeric scores stay null.

`nationalIndicators` are the latest stored UN-Habitat / HDX proportion and total for each country. They are not merged into settlement scores.

## National context

### `GET /api/contextual-indicators/national?country=`

Returns the matched national proportion and total for one country name, or a non-match. Matching is the application’s existing normalized name match.

### `GET /api/map/unhabitat-national-context`

Returns the payload the map uses to color country shapes: source label, max percent, and values keyed by geographic name.

## Imports

### `POST /api/data-sources/atlas-arcgis-discover`

Discovers the Atlas ArcGIS application and imports exposed features in the same request. The response includes whether the app item was found, layer and service counts, URLs, `importableRecordsCount`, `invalidGeometrySkips`, `importedRecords`, `importSkipped`, database atlas counts, notes, and `noPublicLayerMessage` when no public layer is available.

This route writes to the database when importable records exist.

### `GET /api/data-sources/hdx-test`

Read-only HDX check. Returns status (`success`, `partial`, or `failed`), whether HAPI and CKAN responded, dataset and resource counts, sample rows, and notes. It does not store indicator rows.

### `POST /api/import/hdx-unhabitat`

Downloads the two configured UN-Habitat / HDX CSVs and upserts contextual indicators. Returns `ok`, `rowsUpserted`, `rowsPrepared`, `yearsCovered`, and `countriesCovered`.

### `POST /api/import/atlas-geojson`

Imports a GeoJSON body supplied by the caller. Optional `verificationStatus`. Intended for a file the operator already has.

### `POST /api/import/unhabitat`

Separate from the HDX CSV importer. Accepts a caller-supplied body and writes settlement-shaped records with status `submitted`. It is not the national-indicator import.

### `POST /api/import/seed`

Loads the built-in illustrative seed. Those records are demo data.

## Exports

All export routes accept the same query string:

| Parameter | Behavior |
| --- | --- |
| `country` | Exact country string. Empty means no country filter. |
| `minScore` | Drops rows that have a stored score below this value. Rows with no stored score are kept. |
| `maxScore` | Drops rows that have a stored score above this value. Rows with no stored score are kept. |
| `minCompleteness` | Same rule for stored completeness. |

There is no atlas-versus-community filter on these routes.

| Method and path | File / body | Notes |
| --- | --- | --- |
| `GET /api/export/geojson` | JSON feature collection | No `Content-Disposition`. Features require geometry. Missing numbers are JSON null. |
| `GET /api/export/csv` | `settlements.csv` | All filtered rows. No geometry. Missing numbers are empty. Includes `verification_status`. |
| `GET /api/export/kml` | `settlements.kml` | Geometry required. |
| `GET /api/export/shapefile` | `settlements-shapefile.zip` | Geometry required. Includes `.shp`, `.shx`, `.dbf`, and `.prj` (WGS 84). |
| `GET /api/export/dxf` | `settlements.dxf` | Geometry and centroid required. Score text is `NA` when missing. |

Exports do not include questionnaire answers, Architecture, Populace, Site, `atlasReference`, or national indicators.

## Administrative review

### `POST /api/admin/review`

Body:

```json
{
  "settlementId": "string",
  "verificationStatus": "submitted | reviewed | verified | rejected",
  "reviewerNotes": "optional string",
  "userId": "optional string"
}
```

Updates status and notes, then writes an audit log with action `review_status_change`. Unknown settlement: `404`. There is no approve alias and no “request changes” status. `draft` is not set by this route.

The response is the updated settlement row. Callers should treat the change as saved only when the response is successful.
