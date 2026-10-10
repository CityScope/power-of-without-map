import { describe, expect, it, vi } from "vitest";
import { computeAndPersistScore } from "../lib/scoringPipeline";

describe("append-only score recalculation", () => {
  it("creates new score rows on each recalculation", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "score-1", finalInformalityScore: 0.5 })
      .mockResolvedValueOnce({ id: "score-2", finalInformalityScore: 0.6 });
    const db = {
      calculatedScore: {
        findMany: vi.fn().mockResolvedValue([{ finalInformalityScore: 0.4 }, { finalInformalityScore: 0.6 }]),
        create,
      },
    };

    await computeAndPersistScore({
      settlementId: "s1",
      answers: { waterSatisfaction: 0.2 },
      source: "community member",
      calculationVersion: "test-v",
      db: db as never,
    });
    await computeAndPersistScore({
      settlementId: "s1",
      answers: { waterSatisfaction: 0.1 },
      source: "community member",
      calculationVersion: "test-v2",
      db: db as never,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.calculationVersion).toBe("test-v");
    expect(create.mock.calls[1][0].data.calculationVersion).toBe("test-v2");
  });
});
