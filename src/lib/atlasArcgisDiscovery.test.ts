import { describe, expect, it } from "vitest";
import { webMercatorXYToWgs84LonLat } from "./atlasArcgisDiscovery";

describe("atlasArcgisDiscovery web mercator → WGS84", () => {
  it("converts (0,0) to lon/lat origin", () => {
    const [lon, lat] = webMercatorXYToWgs84LonLat(0, 0);
    expect(lon).toBeCloseTo(0, 5);
    expect(lat).toBeCloseTo(0, 5);
  });

  it("converts Web Mercator meters back to WGS84 (central Paris, ~2.35°E 48.86°N)", () => {
    const [lon, lat] = webMercatorXYToWgs84LonLat(261_600.8, 6_251_139.62);
    expect(lon).toBeCloseTo(2.35, 1);
    expect(lat).toBeCloseTo(48.86, 1);
  });
});
