import { describe, expect, it } from "vitest";
import { settlementJsonWithAtlasReference } from "./settlementJson";

describe("settlementJsonWithAtlasReference", () => {
  it("forces true from DB true", () => {
    const out = settlementJsonWithAtlasReference({ id: "1", atlasReference: true });
    expect(out.atlasReference).toBe(true);
    expect("atlasReference" in out).toBe(true);
  });

  it("forces false from DB false", () => {
    const out = settlementJsonWithAtlasReference({ id: "1", atlasReference: false });
    expect(out.atlasReference).toBe(false);
  });

  it("forces false when field was undefined (JSON would have omitted)", () => {
    const out = settlementJsonWithAtlasReference({ id: "1" });
    expect(out.atlasReference).toBe(false);
  });

  it("JSON.stringify keeps atlasReference key", () => {
    const out = settlementJsonWithAtlasReference({ id: "1" });
    const json = JSON.stringify(out);
    expect(json).toContain('"atlasReference":false');
  });
});
