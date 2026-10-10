import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relPath: string) {
  return readFileSync(path.join(root, relPath), "utf-8");
}

describe("map-first navigation shell", () => {
  it("root route renders map-first UI component", () => {
    const home = read("src/app/page.tsx");
    expect(home).toContain("MapExperience");
    expect(home).toContain("return <MapExperience />");
  });

  it("persistent nav includes a Map link", () => {
    const nav = read("src/components/AppNav.tsx");
    expect(nav).toContain("{ href: \"/\", label: \"Map\" }");
  });

  it("profile/edit/summary pages include Back to Map link", () => {
    const profile = read("src/app/settlements/[id]/page.tsx");
    const summary = read("src/app/settlements/[id]/summary/page.tsx");
    const edit = read("src/app/edit-settlement/[id]/page.tsx");

    expect(profile).toContain("Back to Map");
    expect(summary).toContain("Back to Map");
    expect(edit).toContain("Back to Map");
  });
});
