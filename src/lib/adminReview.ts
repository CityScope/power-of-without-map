/**
 * Client-side review summaries. Status counts come from stored verificationStatus.
 * Completeness is never used as a review status, and a missing score stays null.
 */

export type ReviewRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  atlasReference: boolean;
  verificationStatus: string;
  finalScore: number | null;
  completeness: number | null;
  hasGeometry: boolean;
};

export type ReviewOverview = {
  community: number;
  submissions: number;
  submitted: number;
  reviewed: number;
  verified: number;
  rejected: number;
  drafts: number;
  incomplete: number;
};

export const REVIEW_ACTIONS = ["submitted", "reviewed", "verified", "rejected"] as const;

export function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function reviewOverview(rows: ReviewRow[]): ReviewOverview {
  const community = rows.filter((row) => !row.atlasReference);
  return {
    community: community.length,
    submissions: community.filter((row) => row.verificationStatus !== "draft").length,
    submitted: community.filter((row) => row.verificationStatus === "submitted").length,
    reviewed: community.filter((row) => row.verificationStatus === "reviewed").length,
    verified: community.filter((row) => row.verificationStatus === "verified").length,
    rejected: community.filter((row) => row.verificationStatus === "rejected").length,
    drafts: community.filter((row) => row.verificationStatus === "draft").length,
    incomplete: community.filter((row) => row.completeness !== null && row.completeness < 1).length,
  };
}

export function buildReviewRows(list: unknown, analyticsSettlements: unknown): ReviewRow[] | null {
  if (!Array.isArray(list)) return null;
  const observations = new Map<string, { finalScore: number | null; completeness: number | null }>();
  if (Array.isArray(analyticsSettlements)) {
    for (const row of analyticsSettlements) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (typeof record.id !== "string") continue;
      observations.set(record.id, {
        finalScore: finiteOrNull(record.finalScore),
        completeness: finiteOrNull(record.completeness),
      });
    }
  }
  const rows: ReviewRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") continue;
    const observed = observations.get(record.id);
    const listedScores = Array.isArray(record.calculatedScores) ? record.calculatedScores : [];
    const listed = listedScores[0] && typeof listedScores[0] === "object" ? (listedScores[0] as Record<string, unknown>) : null;
    rows.push({
      id: record.id,
      name: record.name,
      city: textOrNull(record.city),
      country: textOrNull(record.country),
      atlasReference: Boolean(record.atlasReference),
      verificationStatus: typeof record.verificationStatus === "string" ? record.verificationStatus : "unknown",
      finalScore: observed ? observed.finalScore : finiteOrNull(listed?.finalInformalityScore),
      completeness: observed ? observed.completeness : null,
      hasGeometry: typeof record.geometry === "string" && record.geometry.trim().length > 0,
    });
  }
  return rows;
}

export function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
