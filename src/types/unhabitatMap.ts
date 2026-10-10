export type UnHabitatMapCountryEntry = {
  displayCountry: string;
  percentUrbanSlums: number | null;
  yearPercent: number;
  totalSlumPopulation: number | null;
  totalUnit: string | null;
  yearTotal: number | null;
};

export type UnHabitatNationalMapPayload = {
  source: string;
  maxPercent: number;
  byGeoName: Record<string, UnHabitatMapCountryEntry>;
};
