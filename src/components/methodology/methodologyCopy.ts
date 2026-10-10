/**
 * Presentation copy for the Methodology page.
 * Numeric weights and ranges were checked against `informalityCalculator.ts`
 * and `normalization.ts`. This module does not calculate scores.
 */

export const PAPER_URL = "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4149958";

export const PAPER_TITLE =
  "Taxonomy of Informality: Methodology for Establishing Multi-dimension Global Informal Indicators to be Used on the Informality Crowd-sourced Database.";

export const LIMITATIONS = [
  "Crowd-sourced and contributed data may reflect participation bias and uneven local coverage.",
  "OpenStreetMap coverage quality is uneven across geographies and can affect suggested values.",
  "Some open-data indicators may be missing, stale, or not available at settlement scale.",
  "Cross-country comparability remains limited by local definitions, governance, and data ecosystems.",
  "The score is a discussion support tool and should never replace local/community-grounded knowledge.",
] as const;

export type FormulaBlock = {
  title: string;
  expression: string;
  detail: string;
};

/** Formulas as implemented. Site is documented here and excluded from the headline score. */
export const IMPLEMENTED_FORMULAS: FormulaBlock[] = [
  {
    title: "Informality Score",
    expression: "0.5 × Architecture + 0.5 × Populace",
    detail:
      "Site is reported alongside this number, as part of the Informality Profile. It is not averaged into the headline score.",
  },
  {
    title: "Architecture",
    expression: "average(Infrastructure, Physical Nature, Compactness)",
    detail: "Each of the three subdimensions has an equal share when it has a score.",
  },
  {
    title: "Infrastructure",
    expression: "0.30 Water + 0.30 Sanitation + 0.20 Energy + 0.10 Connectivity + 0.10 Mobility",
    detail:
      "Community answers about reliability and access are rescaled to 0–1 and inverted, so greater satisfaction lowers the informality contribution.",
  },
  {
    title: "Physical Nature",
    expression: "average(Condition, Materials, Development State)",
    detail: "Housing condition, materials, and development state each take one third. Higher development or better condition maps to lower informality.",
  },
  {
    title: "Compactness",
    expression: "0.45 Overcrowding + 0.20 Floors + 0.35 Compactness satisfaction",
    detail:
      "People per room is scaled from 0 to 8, and a higher count raises informality. Average floors are scaled from 1 to 8 and inverted, because more floors can indicate consolidation. Felt compactness is inverted from a 0–1 satisfaction score.",
  },
  {
    title: "Populace",
    expression: "average(Economy, Quality of Life, Demography)",
    detail: "Each of the three subdimensions has an equal share when it has a score.",
  },
  {
    title: "Economy",
    expression:
      "0.18 Unemployment + 0.16 Informal work + 0.18 Tenure insecurity + 0.15 Home-loss worry + 0.15 Daily out-commuting + 0.18 Economic stress",
    detail:
      "Economy blends unemployment, informal work, tenure insecurity, home-loss worry, daily out-commuting, and economic stress. Rates use a 0–100 scale. Economic satisfaction is inverted.",
  },
  {
    title: "Quality of Life",
    expression: "0.30 Food insecurity + 0.25 Health-service gap + 0.20 Distress + 0.15 Leisure gap + 0.10 Life expectancy",
    detail:
      "The first four terms rise with the reported share of people affected (0–100). Life expectancy is scaled from 40 to 90 years and inverted, so a shorter expectancy raises informality.",
  },
  {
    title: "Demography",
    expression: "equal quarters of Gender equality, Economic equality, Adult literacy, and Mean years of schooling",
    detail:
      "Each term is one quarter. Equality scores and literacy are inverted. Years of schooling are scaled from 0 to 16 and inverted. Lower equality, literacy, or schooling raises informality.",
  },
  {
    title: "Site pillar",
    expression:
      "0.22 Hazard exposure + 0.18 Climate-stress tags + 0.12 Terrain risk + 0.18 Origin + 0.15 Position in the city + 0.15 Community voice",
    detail:
      "The site pillar combines hazard exposure, climate stress tags, terrain risk, origin and spatial-integration proxies, and perceived voice. More community voice lowers this pillar. The pillar is stored with the settlement and is not included in the headline Informality Score. Security, dignity, and open narrative notes stay in the site profile as text.",
  },
];

export const SCORE_STEPS = [
  {
    title: "Community answers",
    text: "Residents and contributors describe water, housing, work, health, learning, and the character of the place in everyday language.",
  },
  {
    title: "Indicators",
    text: "Each question writes one variable. Answers are placed on a 0–1 scale. Where a higher raw answer means better conditions, the scale is turned around so that a higher result still means greater informality.",
  },
  {
    title: "Subdimensions",
    text: "Related indicators are combined with the weights implemented in the platform. A blank answer stays out of that average, and the remaining answers keep their relative weights.",
  },
  {
    title: "Architecture + Populace",
    text: "Infrastructure, physical nature, and compactness together make Architecture. Economy, quality of life, and demography together make Populace.",
  },
  {
    title: "Informality Score",
    text: "Architecture and Populace each contribute half of the headline score. The result stays between 0 and 1.",
  },
] as const;

export const RESEARCH_CONTRIBUTIONS = [
  {
    title: "Informality is multidimensional",
    text: "A settlement is not simply formal or informal. The taxonomy reads several conditions at once.",
  },
  {
    title: "Shared indicators support comparison",
    text: "Common questions give settlements in different places a language for comparison, while local definitions still matter.",
  },
  {
    title: "Community perspectives are essential",
    text: "The work treats locally reported experience as part of the evidence, not as a footnote to outside measurement.",
  },
  {
    title: "Numbers and narratives belong together",
    text: "Quantitative indicators sit beside qualitative characteristics that a single index would leave out.",
  },
  {
    title: "Three lenses, one profile",
    text: "Architecture, Populace, and Site are meant to be read together, so the physical place, the people, and the setting all remain visible.",
  },
  {
    title: "A base for a community-informed map",
    text: "The taxonomy was written to support a crowd-sourced database and an interactive map of informality profiles.",
  },
] as const;

export const SOURCE_NOTES: Record<string, string> = {
  "SSRN taxonomy": "Questionnaire tag for indicators traced to the 2022 taxonomy preprint.",
  "SW taxonomy": "Source label stored on the question. It is shown exactly as recorded in the questionnaire.",
  derived: "Operational question written for this platform’s community questionnaire.",
};
