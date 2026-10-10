import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("atlas arcgis discover import UI", () => {
  it("includes discover button and fallback state key", () => {
    const page = readFileSync(path.join(root, "src/components/data-import/DataSourcesManager.tsx"), "utf-8");
    expect(page).toContain("Discover Atlas ArcGIS Layers");
    expect(page).toContain("Discover Atlas ArcGIS Layers");
    expect(page).toContain("noPublicLayerMessage");
  });
});
