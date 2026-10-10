import { describe, expect, it, vi } from "vitest";
import { testUnHabitatHdxConnection } from "../lib/hdxUnHabitatClient";

type MockResponseInit = {
  ok: boolean;
  status: number;
  body: unknown;
};

function mockResponse(init: MockResponseInit): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (typeof init.body === "string" ? init.body : JSON.stringify(init.body)),
  } as Response;
}

describe("HDX UN-Habitat connector", () => {
  it("handles successful HAPI response", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("hapi.humdata.org/") && !u.includes("/v1/search")) return mockResponse({ ok: true, status: 200, body: { ok: true } });
      if (u.includes("/v1/search")) {
        return mockResponse({
          ok: true,
          status: 200,
          body: {
            data: [
              {
                id: "hapi-sdg111",
                title: "SDG 11.1.1 proportion of urban population living in slums",
                organization: { title: "UN-Habitat" },
                resources: [{ id: "r1", name: "CSV table", format: "csv", url: "https://example.org/hapi.csv" }],
              },
            ],
          },
        });
      }
      if (u.endsWith("hapi.csv")) {
        return mockResponse({ ok: true, status: 200, body: "country,year,value\nKenya,2020,45.2\nColombia,2021,12.3" });
      }
      return mockResponse({ ok: false, status: 404, body: {} });
    });

    const result = await testUnHabitatHdxConnection(fetchMock as unknown as typeof fetch);
    expect(result.status).toBe("partial");
    expect(result.hapiAvailable).toBe(true);
    expect(result.datasetsFound.length).toBeGreaterThan(0);
    expect(result.sampleRows.length).toBeGreaterThan(0);
  });

  it("uses CKAN fallback when HAPI is unavailable", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("hapi.humdata.org/")) return mockResponse({ ok: false, status: 503, body: { error: "down" } });
      if (u.includes("package_show?id=housing-slums-world")) {
        return mockResponse({
          ok: true,
          status: 200,
          body: {
            success: true,
            result: {
              id: "housing-slums-world",
              title: "Housing, slums and informal settlements",
              organization: { title: "UN-Habitat" },
              resources: [{ id: "csv-1", name: "download csv", format: "CSV", url: "https://example.org/ckan.csv" }],
            },
          },
        });
      }
      if (u.endsWith("ckan.csv")) {
        return mockResponse({ ok: true, status: 200, body: "country,indicator,value\nBrazil,sdg111,24.7" });
      }
      return mockResponse({ ok: false, status: 404, body: {} });
    });

    const result = await testUnHabitatHdxConnection(fetchMock as unknown as typeof fetch);
    expect(result.hapiAvailable).toBe(false);
    expect(result.ckanAvailable).toBe(true);
    expect(result.datasetsFound.some((d) => d.source === "ckan")).toBe(true);
    expect(result.status).toBe("partial");
  });

  it("returns failed when no dataset is found", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("hapi.humdata.org/")) return mockResponse({ ok: false, status: 500, body: {} });
      if (u.includes("package_show")) return mockResponse({ ok: false, status: 404, body: { success: false } });
      if (u.includes("package_search")) return mockResponse({ ok: true, status: 200, body: { result: { results: [] } } });
      return mockResponse({ ok: false, status: 404, body: {} });
    });

    const result = await testUnHabitatHdxConnection(fetchMock as unknown as typeof fetch);
    expect(result.status).toBe("failed");
    expect(result.datasetsFound.length).toBe(0);
    expect(result.resourcesFound.length).toBe(0);
  });

  it("records invalid app identifier/authentication issue", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("hapi.humdata.org/")) return mockResponse({ ok: false, status: 401, body: { error: "invalid app_identifier" } });
      if (u.includes("package_show")) return mockResponse({ ok: false, status: 404, body: {} });
      if (u.includes("package_search")) return mockResponse({ ok: true, status: 200, body: { result: { results: [] } } });
      return mockResponse({ ok: false, status: 404, body: {} });
    });

    const result = await testUnHabitatHdxConnection(fetchMock as unknown as typeof fetch);
    expect(result.hapiAvailable).toBe(false);
    expect(result.notes.some((n) => n.toLowerCase().includes("authentication failed"))).toBe(true);
  });
});
