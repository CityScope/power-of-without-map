import { describe, expect, it } from "vitest";
import { calculateInformalityScore } from "../lib/informalityCalculator";
import { normalizeIndicators } from "../lib/normalization";

describe("informality calculation basics", () => {
  it("does not treat missing data as zero", () => {
    const sparse = calculateInformalityScore({ waterSatisfaction: 0.2 });
    const filled = calculateInformalityScore({
      waterSatisfaction: 0.2,
      sanitationSatisfaction: 0.2,
      energySatisfaction: 0.2,
      connectivitySatisfaction: 0.2,
      mobilitySatisfaction: 0.2,
    });
    expect(sparse.infrastructure.score).not.toBeNull();
    expect(filled.infrastructure.score).not.toBeNull();
    // if missing were treated as zero, sparse would be much larger deprivation than filled
    expect(Math.abs((sparse.infrastructure.score ?? 0) - (filled.infrastructure.score ?? 0))).toBeLessThan(0.0001);
  });

  it("normalization enforces higher equals more informal", () => {
    const normalized = normalizeIndicators({
      waterSatisfaction: 0.9, // good service should reduce informality
      unemploymentRate: 90, // high unemployment should increase informality
    });
    const water = normalized.find((i) => i.key === "waterSatisfaction");
    const unemp = normalized.find((i) => i.key === "unemploymentRate");
    expect((water?.normalized ?? 1)).toBeLessThan(0.2);
    expect((unemp?.normalized ?? 0)).toBeGreaterThan(0.8);
  });
});
