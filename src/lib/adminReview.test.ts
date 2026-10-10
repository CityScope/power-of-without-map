import { describe, expect, it } from "vitest";
import { buildReviewRows, isAnswered, reviewOverview } from "./adminReview";

describe("admin review summaries", () => {
  it("counts stored statuses and does not treat completeness as a decision", () => {
    const rows = buildReviewRows(
      [
        { id: "a", name: "One", country: "Mexico", city: "GDL", atlasReference: false, verificationStatus: "submitted", geometry: "{\"type\":\"Polygon\"}", calculatedScores: [{ finalInformalityScore: 0 }] },
        { id: "b", name: "Two", country: "Mexico", atlasReference: false, verificationStatus: "verified", geometry: "", calculatedScores: [] },
        { id: "c", name: "Three", atlasReference: false, verificationStatus: "rejected", calculatedScores: [] },
        { id: "d", name: "Draft", atlasReference: false, verificationStatus: "draft", calculatedScores: [] },
        { id: "e", name: "Atlas", atlasReference: true, verificationStatus: "reviewed", geometry: "{}", calculatedScores: [{ finalInformalityScore: 0.9 }] },
      ],
      [
        { id: "a", finalScore: 0, completeness: 0.4 },
        { id: "b", finalScore: null, completeness: 1 },
        { id: "c", finalScore: null, completeness: null },
        { id: "d", finalScore: null, completeness: 0.2 },
        { id: "e", finalScore: null, completeness: 0 },
      ],
    );
    expect(rows?.[0].finalScore).toBe(0);
    expect(rows?.[1].finalScore).toBeNull();
    expect(rows?.[4].finalScore).toBeNull();
    expect(rows?.[0].hasGeometry).toBe(true);
    expect(rows?.[1].hasGeometry).toBe(false);
    const overview = reviewOverview(rows ?? []);
    expect(overview).toMatchObject({
      community: 4,
      submissions: 3,
      submitted: 1,
      reviewed: 0,
      verified: 1,
      rejected: 1,
      drafts: 1,
      incomplete: 2,
    });
  });

  it("keeps a stored zero and treats blank answers as unanswered", () => {
    expect(isAnswered(0)).toBe(true);
    expect(isAnswered(false)).toBe(true);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered("  ")).toBe(false);
    expect(isAnswered([])).toBe(false);
  });
});
