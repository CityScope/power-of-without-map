export type NumericMaybe = number | null | undefined;

export type WeightedInput = {
  key: string;
  value: NumericMaybe;
  weight: number;
};

export type CalculationResult = {
  score: number | null;
  usedKeys: string[];
  missingKeys: string[];
};

export type InformalityBand =
  | "Low informality"
  | "Moderate-low"
  | "Moderate"
  | "High"
  | "Very high";

export type SiteProfile = {
  origin?: string;
  topography?: string[];
  withinCityCondition?: string;
  climateVulnerability?: string[];
  securityNotes?: string;
  dignityNotes?: string;
  narrative?: string;
};

export type SurveyAnswers = Record<string, string | number | boolean | null | undefined>;

export type InformalityScoreResult = {
  infrastructure: CalculationResult;
  physicalNature: CalculationResult;
  compactness: CalculationResult;
  architecture: CalculationResult;
  economy: CalculationResult;
  qualityOfLife: CalculationResult;
  demography: CalculationResult;
  populace: CalculationResult;
  /** Third pillar: hazards, spatial stress, voice — does not change the core Architecture/Populace blend. */
  sitePillar: CalculationResult;
  siteProfile: SiteProfile;
  finalScore: number | null;
  completeness: number;
  missingVariables: string[];
  band: InformalityBand | null;
};
