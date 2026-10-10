/**
 * Map UN-Habitat/HDX `countryName` values onto GeoJSON `properties.name` (johan world.geo.json),
 * with aliases for M49/short-name mismatches.
 */

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Optional variant → canonical name as it appears in public/geo/countries.geo.json
 * Keys are normalized (see `norm`); values are exact GeoJSON labels.
 */
const UN_TO_GEO: Record<string, string> = {
  "united states": "United States of America",
  "united states of america": "United States of America",
  "russian federation": "Russia",
  "iran (islamic republic of)": "Iran",
  "venezuela (bolivarian republic of)": "Venezuela",
  "bolivia (plurinational state of)": "Bolivia",
  "korea, republic of": "South Korea",
  "korea, democratic peoples republic of": "North Korea",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "lao people's democratic republic": "Laos",
  "laos peoples democratic republic": "Laos",
  "moldova, republic of": "Moldova",
  "syrian arab republic": "Syria",
  "tanzania, united republic of": "United Republic of Tanzania",
  "tanzania united republic of": "United Republic of Tanzania",
  "congo, democratic republic of the": "Democratic Republic of the Congo",
  "congo, republic of the": "Republic of the Congo",
  "czechia": "Czech Republic",
  "cabo verde": "Cape Verde",
  "eswatini": "Eswatini",
  "myanmar": "Myanmar",
  "north macedonia": "Macedonia",
  "macedonia, north": "Macedonia",
  "macedonia the former yugoslav republic of": "Macedonia",
  "palestine, state of": "Palestine",
};

function findGeo(needle: string, geoNames: string[]): string | null {
  for (const g of geoNames) {
    if (norm(g) === needle) return g;
  }
  return null;
}

/**
 * @param hdxCountryName - value from `ContextualIndicator.countryName`
 * @param geoNames - `properties.name` for each feature in public/geo/countries.geo.json
 */
export function matchHdxCountryToGeoName(hdxCountryName: string, geoNames: string[]): string | null {
  if (!hdxCountryName?.trim()) return null;
  const n = norm(hdxCountryName);
  const direct = findGeo(n, geoNames);
  if (direct) return direct;

  const throughAlias = UN_TO_GEO[n];
  if (throughAlias) {
    const a = findGeo(norm(throughAlias), geoNames);
    if (a) return a;
  }

  return null;
}
