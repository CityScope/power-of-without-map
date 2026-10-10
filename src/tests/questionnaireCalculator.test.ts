import { describe, expect, it } from "vitest";
import { buildSurveyAnswersFromWizard, CALCULATOR_COVERED_VARIABLE_KEYS, CALCULATOR_NUMERIC_VARIABLE_KEYS } from "../lib/questionnaireBridge";
import { calculateInformalityScore } from "../lib/informalityCalculator";
import { QUESTIONNAIRE_QUESTIONS } from "../lib/questionnaireSchema";

describe("questionnaire ↔ calculator alignment", () => {
  it("every calculator-covered variable has at least one questionnaire question", () => {
    const mapped = new Set(QUESTIONNAIRE_QUESTIONS.map((q) => q.mapsToVariable));
    for (const key of CALCULATOR_COVERED_VARIABLE_KEYS) {
      expect(mapped.has(key)).toBe(true);
    }
  });

  it("every numeric calculator input has a question (SSRN stack)", () => {
    const mapped = new Set(QUESTIONNAIRE_QUESTIONS.map((q) => q.mapsToVariable));
    for (const key of CALCULATOR_NUMERIC_VARIABLE_KEYS) {
      expect(mapped.has(key)).toBe(true);
    }
  });

  it("empty wizard answers do not coerce keys to zero", () => {
    const answers = buildSurveyAnswersFromWizard({});
    expect(answers.waterSatisfaction).toBeUndefined();
    expect(answers.unemploymentRate).toBeUndefined();
    const r = calculateInformalityScore(answers);
    expect(r.infrastructure.score).toBeNull();
    expect(r.economy.score).toBeNull();
  });

  it("skipped sections (only water) do not break calculation", () => {
    const r = calculateInformalityScore({ waterSatisfaction: 0.3 });
    expect(r.infrastructure.score).not.toBeNull();
    expect(r.populace.score).toBeNull();
    expect(r.finalScore).not.toBeNull();
    expect(Number.isFinite(r.finalScore ?? NaN)).toBe(true);
  });

  it("score changes when merged questionnaire answers change", () => {
    const a = buildSurveyAnswersFromWizard({ water_reliability: 20 });
    const b = buildSurveyAnswersFromWizard({ water_reliability: 90 });
    const ra = calculateInformalityScore(a);
    const rb = calculateInformalityScore(b);
    expect(ra.infrastructure.score).not.toBeNull();
    expect(rb.infrastructure.score).not.toBeNull();
    expect(ra.infrastructure.score).not.toBeCloseTo(rb.infrastructure.score ?? 0, 3);
  });
});
