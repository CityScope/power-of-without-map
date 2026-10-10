import { describe, expect, it } from "vitest";

describe("settlementListScores batching", () => {
  it("uses batches of 400 ids max per chunk", () => {
    const BATCH_SIZE = 400;
    const ids = Array.from({ length: 950 }, (_, i) => `id-${i}`);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      chunks.push(ids.slice(i, i + BATCH_SIZE));
    }
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(400);
    expect(chunks[1]).toHaveLength(400);
    expect(chunks[2]).toHaveLength(150);
  });
});
