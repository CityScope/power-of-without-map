import { QUESTIONNAIRE_QUESTIONS } from "@/lib/questionnaireSchema";
import { SurveyAnswers } from "@/types/informality";

/** Raw wizard field values keyed by question `id` (sliders often 0–100 from UI). */
export type WizardAnswersRecord = Record<string, unknown>;

const SLIDER_TO_ZERO_ONE_VARS = new Set([
  "waterSatisfaction",
  "housingConditionSatisfaction",
  "materialsSatisfaction",
  "compactnessSatisfaction",
  "economicSatisfaction",
  "genderEquality",
  "economicEquality",
  "siteHazardExposureScore",
  "siteCommunityInfluenceScore",
]);

/** sanitationSatisfaction is stored 0–1 but collected as toilet access % in UI. */
const PERCENT_TO_SATISFACTION_VARS = new Set(["sanitationSatisfaction"]);

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merge wizard answers into `SurveyAnswers` for the calculator.
 * Omitted keys stay absent (undefined) — never coerced to zero.
 */
export function buildSurveyAnswersFromWizard(
  rawByQuestionId: WizardAnswersRecord,
  extra?: Partial<SurveyAnswers>,
): SurveyAnswers {
  const out: SurveyAnswers = { ...extra };

  for (const q of QUESTIONNAIRE_QUESTIONS) {
    const raw = rawByQuestionId[q.id];
    if (isEmpty(raw)) continue;

    const key = q.mapsToVariable;

    if (q.inputType === "multiselect" && Array.isArray(raw)) {
      const parts = raw.map(String).filter(Boolean);
      if (parts.length) out[key] = parts.join(",");
      continue;
    }

    if (q.inputType === "textarea" || (q.inputType === "select" && typeof raw === "string")) {
      out[key] = String(raw).trim();
      continue;
    }

    if (q.inputType === "boolean") {
      out[key] = Boolean(raw);
      continue;
    }

    const n = toNumberOrNull(raw);
    if (n === null) continue;

    if (SLIDER_TO_ZERO_ONE_VARS.has(key)) {
      const clamped = Math.max(0, Math.min(100, n));
      out[key] = clamped / 100;
      continue;
    }

    if (PERCENT_TO_SATISFACTION_VARS.has(key)) {
      const clamped = Math.max(0, Math.min(100, n));
      out[key] = clamped / 100;
      continue;
    }

    if (q.inputType === "percentage") {
      out[key] = Math.max(0, Math.min(100, n));
      continue;
    }

    if (q.inputType === "select" && typeof raw === "number") {
      out[key] = raw;
      continue;
    }

    out[key] = n;
  }

  return out;
}

/** Variables that participate in the numeric informality engine (for coverage tests). */
export const CALCULATOR_NUMERIC_VARIABLE_KEYS = [
  "waterSatisfaction",
  "sanitationSatisfaction",
  "energySatisfaction",
  "connectivitySatisfaction",
  "mobilitySatisfaction",
  "housingConditionSatisfaction",
  "materialsSatisfaction",
  "structureDevelopmentScore",
  "peoplePerRoom",
  "avgFloors",
  "compactnessSatisfaction",
  "unemploymentRate",
  "informalEmploymentRate",
  "insecureTenurePct",
  "homeOwnershipInsecurityPct",
  "residentsWorkingOutsidePct",
  "economicSatisfaction",
  "foodInsecurityPct",
  "withoutAffordableHealthPct",
  "depressedPct",
  "insufficientLeisurePct",
  "lifeExpectancy",
  "genderEquality",
  "economicEquality",
  "adultLiteracyRate",
  "meanYearsSchooling",
  "siteHazardExposureScore",
  "siteCommunityInfluenceScore",
] as const;

/** Numeric + categorical strings read by the calculator or site profile. */
export const CALCULATOR_COVERED_VARIABLE_KEYS = [
  ...CALCULATOR_NUMERIC_VARIABLE_KEYS,
  "originType",
  "withinCityCondition",
  "climateVulnerability",
  "topography",
  "securityNotes",
  "dignityNotes",
  "narrative",
] as const;

/**
 * Populate wizard question state from persisted `SurveyAnswers` / `rawAnswersJson`.
 */
export function surveyAnswersToWizardRaw(answers: Record<string, unknown>): WizardAnswersRecord {
  const raw: WizardAnswersRecord = {};
  for (const q of QUESTIONNAIRE_QUESTIONS) {
    const v = answers[q.mapsToVariable];
    if (v === null || v === undefined || v === "") continue;

    if (q.inputType === "multiselect") {
      if (Array.isArray(v)) raw[q.id] = v.map(String);
      else if (typeof v === "string") raw[q.id] = v.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    if (q.inputType === "slider" && SLIDER_TO_ZERO_ONE_VARS.has(q.mapsToVariable)) {
      const n = Number(v);
      if (Number.isFinite(n)) raw[q.id] = Math.round(n * 100);
      continue;
    }

    if (PERCENT_TO_SATISFACTION_VARS.has(q.mapsToVariable)) {
      const n = Number(v);
      if (Number.isFinite(n)) raw[q.id] = Math.round(n * 100);
      continue;
    }

    raw[q.id] = v as string | number | boolean;
  }
  return raw;
}
