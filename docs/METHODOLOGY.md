# Informality methodology

This document describes the scoring implemented in this repository. The source of truth is `src/lib/informalityCalculator.ts`, `src/lib/normalization.ts`, and `src/lib/scoringPipeline.ts`.

It is not a restatement of the 2022 preprint. Where the software and the paper differ, the software behavior below is the one the application uses.

## Research foundation

The questionnaire and the three-part reading of informality follow:

Wang, Xinran; Iruretagoyena, Maitane; Alonso Pastor, Luis; Larson, Kent. 2022. *Taxonomy of Informality: Methodology for Establishing Multi-dimension Global Informal Indicators to be Used on the Informality Crowd-sourced Database.* Research preprint. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4149958

The broader research setting is the MIT Media Lab City Science project [The Power of Without](https://www.media.mit.edu/projects/power-of-without-1/overview/).

The preprint is not described here as a peer-reviewed journal article, and no DOI is recorded in this repository.

The taxonomy treats informality as multidimensional: physical conditions (Architecture), people’s conditions (Populace), and the setting (Site). The software keeps all three visible. Only Architecture and Populace enter the headline number.

## Headline score

```text
Informality Score = 0.5 × Architecture + 0.5 × Populace
```

Both inputs are 0–1, where a higher value means greater informality. If either dimension has no available score, that input is left out and the remaining input keeps its weight through the shared weighted-average rule. If neither dimension has a score, the headline score is null.

Stored scores are not replaced with zero when they are missing.

Bands, used for display when a score exists:

| Score | Band |
| --- | --- |
| below 0.20 | Low informality |
| below 0.40 | Moderate-low |
| below 0.60 | Moderate |
| below 0.80 | High |
| 0.80 and above | Very high |

## Missing values

`weightedAverageAvailable` drops inputs that are null or undefined, sums the weights of the inputs that remain, and divides by that sum. It does not impute zero.

A stored numeric zero is a real value and stays in the average.

## Architecture

Architecture is the equal-weight average of the subdimension scores that exist:

```text
Architecture = average(Infrastructure, Physical Nature, Compactness)
```

### Infrastructure

| Indicator | Weight |
| --- | --- |
| Water | 0.30 |
| Sanitation | 0.30 |
| Energy | 0.20 |
| Connectivity | 0.10 |
| Mobility | 0.10 |

Satisfaction-style answers are rescaled to 0–1 and inverted, so greater satisfaction lowers the informality contribution.

### Physical nature

Condition, materials, and development state each have weight 1/3. Better condition or greater consolidation maps to lower informality.

### Compactness

| Indicator | Weight | Scaling in the calculator |
| --- | --- | --- |
| Overcrowding (people per room) | 0.45 | 0–8, higher raises informality |
| Floors | 0.20 | 1–8, inverted |
| Compactness satisfaction | 0.35 | 0–1, inverted |

## Populace

Populace is the equal-weight average of the subdimension scores that exist:

```text
Populace = average(Economy, Quality of Life, Demography)
```

### Economy

| Indicator | Weight |
| --- | --- |
| Unemployment | 0.18 |
| Informal employment | 0.16 |
| Tenure insecurity | 0.18 |
| Home-loss worry | 0.15 |
| Daily out-commuting | 0.15 |
| Economic satisfaction | 0.18 |

Rates use a 0–100 scale. Economic satisfaction is inverted.

### Quality of life

| Indicator | Weight |
| --- | --- |
| Food insecurity | 0.30 |
| Health-service gap | 0.25 |
| Distress | 0.20 |
| Leisure gap | 0.15 |
| Life expectancy | 0.10 |

The first four rise with the reported share (0–100). Life expectancy is scaled from 40 to 90 years and inverted.

### Demography

Each of the following has weight 0.25:

- Gender equality, inverted
- Economic equality, inverted
- Adult literacy, inverted from 0–100
- Mean years of schooling, scaled from 0 to 16 and inverted

## Site

Site is contextual. It is stored on the score record and shown in the interface. It is not an input to the headline Informality Score.

The numeric site pillar, when answers exist, is:

| Input | Weight |
| --- | --- |
| Hazard exposure | 0.22 |
| Climate-stress tags | 0.18 |
| Terrain risk | 0.12 |
| Origin | 0.18 |
| Position in the city | 0.15 |
| Community voice | 0.15 |

More community voice lowers this pillar. Security notes, dignity notes, and the open narrative stay as text in the site profile. They are not folded into the headline score.

Origin and position use fixed stress lookups in `calculateSitePillar` (for example `planned_relocation` = 0.22 and `severed` = 0.88). Unknown labels do not receive an invented stress value.

## Normalization

Persisted normalization metadata uses `normalizationVersion` `norm-v1` and `formulaVersion` `formula-v1`.

`normalizeIndicators` maps raw answers onto 0–1 with direction `higher_is_worse`. Values are clamped to the indicator’s min and max. Indicators marked invert are stored as `1 - scaled`.

The calculator applies the same direction when it builds dimension scores. The two modules are the operational pair. Do not replace either with a formula copied only from the preprint.

## Completeness

Completeness is the share of calculator inputs that were available:

```text
completeness = used keys / (used keys + missing keys)
```

The keys counted are those of infrastructure, physical nature, compactness, economy, quality of life, demography, and the site pillar. This is indicator coverage. It is not the Add Settlement step number, and it is not “8 of 8 wizard pages.”

If that denominator is zero, the function returns 0. That edge case is not the same as treating a missing headline score as zero. The headline score remains null when Architecture and Populace have no values.

## Uncertainty and related fields

When a score is persisted, uncertainty is:

```text
uncertainty = 1 - (0.5 × completeness + 0.25 × OSM confidence + 0.25 × source reliability)
```

The result is clamped to 0–1. This is a stored heuristic. It is not a statistical confidence interval.

Global percentile rank is the rank of the headline score among scores passed into `percentileRank` at calculation time. It is relative to the recorded set used for that calculation, not a claim about all informal settlements worldwide.

## What this implementation does not do

- It does not put Site into the headline score.
- It does not fill missing indicators with zero.
- It does not merge UN-Habitat national indicators into a settlement score.
- It does not treat atlas reference geometries as completed questionnaires.
- It does not claim the weights above are a verbatim copy of every formula in the preprint.

## Limitations

- Contributed answers can reflect who was able to participate.
- OpenStreetMap coverage used for suggestions is uneven.
- Some indicators may be missing at settlement scale.
- Cross-place comparison is limited by local definitions and institutions.
- The number supports discussion. It does not replace community knowledge.
