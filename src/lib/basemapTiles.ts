/** Standard OSM raster tiles (fallback). */
export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Thunderforest OpenCycleMap layer (same family as osm.org “Cycle Map”). */
export const THUNDERFOREST_CYCLE_ATTRIBUTION = `${OSM_ATTRIBUTION} &mdash; Tiles &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>`;

export function thunderforestCycleTileUrl(apiKey: string): string {
  const key = apiKey.trim();
  return `https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${encodeURIComponent(key)}`;
}

export type SettlementBasemapConfig = {
  url: string;
  attribution: string;
  /** True when Thunderforest cycle tiles are used (API key present). */
  useCycleMap: boolean;
};

/**
 * Main settlement map basemap: Thunderforest cycle tiles when
 * `NEXT_PUBLIC_THUNDERFOREST_API_KEY` is set, otherwise standard OSM.
 */
export function getSettlementMapBasemap(): SettlementBasemapConfig {
  const key = process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY?.trim();
  if (key) {
    return {
      url: thunderforestCycleTileUrl(key),
      attribution: THUNDERFOREST_CYCLE_ATTRIBUTION,
      useCycleMap: true,
    };
  }
  return {
    url: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
    useCycleMap: false,
  };
}
