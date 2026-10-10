import { describe, expect, it, vi } from "vitest";
import { getSettlementMapBasemap, OSM_TILE_URL, thunderforestCycleTileUrl } from "./basemapTiles";

describe("getSettlementMapBasemap", () => {
  it("uses Thunderforest cycle URL when NEXT_PUBLIC_THUNDERFOREST_API_KEY is set", () => {
    vi.stubEnv("NEXT_PUBLIC_THUNDERFOREST_API_KEY", "test-key-123");
    const cfg = getSettlementMapBasemap();
    expect(cfg.useCycleMap).toBe(true);
    expect(cfg.url).toContain("tile.thunderforest.com/cycle/");
    expect(cfg.url).toContain("apikey=test-key-123");
    expect(cfg.attribution).toContain("Thunderforest");
    vi.unstubAllEnvs();
  });

  it("falls back to OSM when key is missing or empty", () => {
    vi.stubEnv("NEXT_PUBLIC_THUNDERFOREST_API_KEY", "");
    const cfg = getSettlementMapBasemap();
    expect(cfg.useCycleMap).toBe(false);
    expect(cfg.url).toBe(OSM_TILE_URL);
    expect(cfg.attribution).not.toContain("Thunderforest");
    vi.unstubAllEnvs();
  });
});

describe("thunderforestCycleTileUrl", () => {
  it("encodes api key in query string", () => {
    const u = thunderforestCycleTileUrl("a&b=c");
    expect(u).toContain(encodeURIComponent("a&b=c"));
  });
});
