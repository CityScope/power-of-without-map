# Data sources

This application holds three kinds of information. They are not interchangeable.

## Atlas of Informality

**Purpose.** Reference settlement geometries from the public Atlas of Informality.

**Source page.** https://www.atlasofinformality.com/

**How this app reaches it.** `src/lib/atlasArcgisDiscovery.ts` reads a public ArcGIS application item, then its web map and feature services. The discover action is `POST /api/data-sources/atlas-arcgis-discover`.

**What that action does.** It discovers layers and, when it finds importable features, writes them. It is not a read-only preview. Imported rows are stored as settlements with `atlasReference: true`, source name “Atlas of Informality”, and source URL `https://www.atlasofinformality.com/`.

**Geometry.** Polygon or multipolygon features that pass the importer’s geometry checks. Invalid geometries are skipped and counted. They are not repaired into a different shape by the documentation layer.

**Metadata the importer stores.** Name and place fields available on the feature, geometry, centroid, and area. These rows are not community questionnaires. A missing Informality Score on an atlas row means no score was calculated from a questionnaire. It is not a score of zero.

**Limitations.**

- The public ArcGIS item may expose no downloadable feature layer. The API then returns a message and does not invent records.
- Layer titles and a preview-before-import are not returned as a separate catalog.
- This repository does not record a license for redistributing Atlas geometries. Confirm that with the Atlas of Informality before a public data release.
- Importing is not a partnership with the Atlas of Informality.

## UN-Habitat / HDX

**Purpose.** National context for SDG 11.1.1. These figures describe countries. They are not settlement boundaries and they are not Informality Scores.

**Provenance label stored in the database.** `UN-Habitat / HDX`

**Dataset.** HDX dataset id `977c5121-6343-41e2-bc5d-6b13302fcf02`.

**Files the importer downloads.**

- Proportion of urban population living in slums or informal settlements: the CSV URL in `HDX_CSV_PROPORTION_URL`.
- Total population living in slums and informal settlements: the CSV URL in `HDX_CSV_TOTAL_URL`.

Indicator names stored by the app:

- `Proportion of urban population living in slums or informal settlements`
- `Total population living in slums and informal settlements`

**Workflow.**

- `GET /api/data-sources/hdx-test` checks connectivity and returns sample metadata. It does not write rows.
- `POST /api/import/hdx-unhabitat` downloads the CSVs and upserts `ContextualIndicator` rows, including the year found on each row.

Units come from the CSV “Data Units” column.

**Optional credential.** `HDX_HAPI_APP_IDENTIFIER` is sent only when it is set. The CSV import path does not require it.

**Limitations.**

- Coverage is national, and only where the HDX tables contain a value.
- Years are the years present in the imported rows. The app does not fill the years in between.
- Country names must match after the app’s existing name normalization. The app does not fuzzy-match typos.
- A national percentage must not be read as a settlement score.
- This repository does not grant a license to redistribute the HDX tables. HDX and UN-Habitat terms apply to the data. Using the public CSV is not an institutional partnership.

## Community-contributed settlements

**Purpose.** Profiles created in this application.

**What is stored.**

- Settlement name, local name, city, country, population, source, and notes.
- GeoJSON boundary and centroid, plus area in square meters when the API saves the geometry.
- Questionnaire answers in `SurveyResponse.rawAnswersJson`.
- A `CalculatedScore` when the scoring pipeline runs.
- `verificationStatus`: `draft`, `submitted`, `reviewed`, `verified`, or `rejected`.
- Reviewer notes and audit rows when an admin status change is saved.

**How they differ from atlas rows.** `atlasReference` is false. They can be edited and, unlike atlas rows, deleted through the settlement API. They can carry questionnaire answers and a score. Atlas rows generally do not.

**Review.** Status changes go through `POST /api/admin/review`. Notes are saved with the status change. There is no separate “request changes” state.

**Privacy.** Community records can contain place names, notes, and precise boundaries. The local database file `prisma/dev.db` is gitignored. Do not commit that file or export files that contain non-public contributions.

## Illustrative seed file

`data/seed-settlements.json` is a small labeled sample (“illustrative”). `npm run seed` loads demo records. Those records are not verified observations.

## Map boundaries for countries

The running application looks for `public/geo/countries.geo.json` when it draws the national context layer and when `GET /api/map/unhabitat-national-context` matches country names. That file is not a UN-Habitat dataset and it is not a settlement boundary.

The local copy is byte-identical to `countries.geo.json` in [johan/world.geo.json](https://github.com/johan/world.geo.json). That repository describes the legal status of the file as unresolved and points readers to Natural Earth instead. Natural Earth’s own vector data is in the public domain, but this packaged file’s redistribution rights are not established. It is therefore listed in `.gitignore` and is not part of the published repository. The local file is left in place.

On a fresh clone, settlement polygons and bubbles still load. The national choropleth does not, because the browser request for `/geo/countries.geo.json` fails and the national-context API cannot read the file.
