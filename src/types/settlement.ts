/**
 * Map list rows come from GET /api/settlements (slim payload).
 * Detail views merge GET /api/settlements/[id] which includes scores, area, etc.
 */
export type SettlementRecord = {
  id: string;
  name: string;
  localName?: string | null;
  city?: string | null;
  country?: string | null;
  geometry: string;
  centroid: string;
  /** Present on GET /api/settlements/[id]; omitted from list endpoint. */
  areaM2?: number;
  population?: number | null;
  source?: string | null;
  sourceUrl?: string | null;
  /** Always boolean on GET /api/settlements and GET /api/settlements/[id] JSON. */
  atlasReference: boolean;
  createdBy?: string | null;
  verificationStatus: string;
  calculatedScores?: Array<{
    finalInformalityScore: number | null;
    globalPercentileRank?: number | null;
    completenessScore: number | null;
    confidenceScore?: number | null;
    sourceReliabilityScore?: number | null;
    uncertaintyScore?: number | null;
    normalizationVersion?: string | null;
    formulaVersion?: string | null;
    calculationVersion?: string | null;
    missingVariablesJson?: string | null;
  }>;
  surveyResponses?: Array<{ rawAnswersJson: string }>;
};
