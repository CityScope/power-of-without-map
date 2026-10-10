# Changelog

This repository has no published releases and no version tags. The version in `package.json` is `0.1.0`. Dates below are not release dates.

## Unreleased

The current research platform is in this repository. There are no version tags. The capabilities below are the published application.

### Platform

- Interactive Leaflet map with settlement polygons and area-scaled bubbles. A stored Informality Score is shown as the bubble core. Atlas records are amber. Community records are green.
- Atlas of Informality import through the public ArcGIS application item. Imported rows are stored as atlas references.
- Eight-step Add Settlement wizard with boundary drawing, questionnaire, score preview, draft save, and submit.
- Informality Score implemented as `0.5 × Architecture + 0.5 × Populace`, with Site calculated separately. Missing inputs are omitted rather than treated as zero.
- Methodology page aligned with the implemented weights.
- Analytics observatory for scores, completeness, geography, and comparison. National UN-Habitat indicators stay separate from settlement scores.
- UN-Habitat / HDX import of SDG 11.1.1 national proportion and total population indicators, plus a read-only connection test.
- Exports: GeoJSON, CSV, KML, Shapefile ZIP, and DXF, with country and stored-score filters.
- Admin review for statuses `submitted`, `reviewed`, `verified`, and `rejected`, with notes saved on the status change and an audit log.
- No authentication layer.

### Documentation in this unreleased state

- README, contributing guide, methodology, architecture, data sources, API, and local development notes.
