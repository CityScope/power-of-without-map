type FetchLike = typeof fetch;

export type HdxDatasetHit = {
  id: string;
  title: string;
  source: "hapi" | "ckan";
  organization?: string;
  matchedBy?: string;
  url?: string;
};

export type HdxResourceHit = {
  id: string;
  name: string;
  format?: string;
  url: string;
  source: "hapi" | "ckan";
};

export type HdxTestResult = {
  status: "success" | "partial" | "failed";
  hapiAvailable: boolean;
  ckanAvailable: boolean;
  datasetsFound: HdxDatasetHit[];
  resourcesFound: HdxResourceHit[];
  sampleRows: Array<Record<string, string>>;
  notes: string[];
};

const HAPI_BASE = "https://hapi.humdata.org";
const CKAN_BASE = "https://data.humdata.org/api/3/action";

const KEYWORDS = [
  "housing",
  "slums",
  "informal settlements",
  "SDG 11.1.1",
  "proportion of urban population living in slums",
  "total urban population living in slums",
] as const;

function hapiHeaders(): HeadersInit {
  const appIdentifier = process.env.HDX_HAPI_APP_IDENTIFIER?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (appIdentifier) headers["app-identifier"] = appIdentifier;
  return headers;
}

function compact<T>(arr: Array<T | null | undefined>): T[] {
  return arr.filter(Boolean) as T[];
}

function toStringSafe(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

async function fetchJson(url: string, fetchImpl: FetchLike, headers?: HeadersInit) {
  const res = await fetchImpl(url, { headers, cache: "no-store" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function flattenToRecords(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) return input.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
  if (!input || typeof input !== "object") return [];
  const asObj = input as Record<string, unknown>;
  const commonKeys = ["data", "results", "items", "resources", "datasets", "records"];
  for (const key of commonKeys) {
    if (Array.isArray(asObj[key])) {
      return (asObj[key] as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
    }
  }
  return [];
}

function looksSlumLike(record: Record<string, unknown>): boolean {
  const blob = Object.values(record).map(toStringSafe).join(" ").toLowerCase();
  return KEYWORDS.some((k) => blob.includes(k.toLowerCase()));
}

function mapResource(record: Record<string, unknown>, source: "hapi" | "ckan"): HdxResourceHit | null {
  const url = toStringSafe(record.url || record.download_url || record.href);
  if (!url) return null;
  return {
    id: toStringSafe(record.id || record.name || url),
    name: toStringSafe(record.name || record.title || "resource"),
    format: toStringSafe(record.format || record.filetype || "").toUpperCase() || undefined,
    url,
    source,
  };
}

function mapDataset(record: Record<string, unknown>, source: "hapi" | "ckan", matchedBy: string): HdxDatasetHit {
  const id = toStringSafe(record.id || record.name || record.slug || "dataset");
  const title = toStringSafe(record.title || record.name || id);
  const org = record.organization && typeof record.organization === "object"
    ? toStringSafe((record.organization as Record<string, unknown>).title || (record.organization as Record<string, unknown>).name)
    : toStringSafe(record.organization);
  const url = toStringSafe(record.url || record.hdx_url || record.dataset_url || "");
  return {
    id,
    title,
    source,
    organization: org || undefined,
    matchedBy,
    url: url || undefined,
  };
}

async function fetchCsvSampleRows(resourceUrl: string, fetchImpl: FetchLike): Promise<Array<Record<string, string>>> {
  const res = await fetchImpl(resourceUrl, { cache: "no-store" });
  if (!res.ok) return [];
  const raw = await res.text();
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const sample = lines.slice(1, 4);
  return sample.map((line) => {
    const cols = line.split(",");
    return Object.fromEntries(headers.map((h, idx) => [h || `col_${idx + 1}`, (cols[idx] ?? "").trim()]));
  });
}

export async function testHdxHapiConnection(fetchImpl: FetchLike = fetch) {
  const notes: string[] = [];
  const appIdentifier = process.env.HDX_HAPI_APP_IDENTIFIER?.trim();
  if (!appIdentifier) notes.push("HDX_HAPI_APP_IDENTIFIER is not set; HAPI may reject or throttle requests.");
  const probeEndpoints = [`${HAPI_BASE}/`, `${HAPI_BASE}/v1/metadata`];
  for (const endpoint of probeEndpoints) {
    const probe = await fetchJson(endpoint, fetchImpl, hapiHeaders());
    if (probe.ok) return { available: true, notes };
    if (probe.status === 401 || probe.status === 403) {
      notes.push(`HAPI authentication failed (${probe.status}) using current app identifier.`);
      return { available: false, notes };
    }
  }
  notes.push("HAPI probe endpoints did not return success.");
  return { available: false, notes };
}

export async function searchSlumIndicators(fetchImpl: FetchLike = fetch) {
  const datasets: HdxDatasetHit[] = [];
  const resources: HdxResourceHit[] = [];
  const notes: string[] = [];
  const endpoints = compact(KEYWORDS.map((keyword) => `${HAPI_BASE}/v1/search?query=${encodeURIComponent(keyword)}`));

  for (const endpoint of endpoints) {
    const res = await fetchJson(endpoint, fetchImpl, hapiHeaders());
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) notes.push(`HAPI search auth error (${res.status}) for query endpoint.`);
      continue;
    }
    const records = flattenToRecords(res.json);
    for (const rec of records) {
      if (!looksSlumLike(rec)) continue;
      datasets.push(mapDataset(rec, "hapi", "keyword-search"));
      const nestedResources = flattenToRecords(rec.resources);
      for (const rr of nestedResources) {
        const r = mapResource(rr, "hapi");
        if (r) resources.push(r);
      }
    }
  }

  const uniqueDatasets = Array.from(new Map(datasets.map((d) => [d.id, d])).values());
  const uniqueResources = Array.from(new Map(resources.map((r) => [r.url, r])).values());
  if (!uniqueDatasets.length) notes.push("HAPI search returned no matching slum/informal indicator datasets.");

  return { datasets: uniqueDatasets, resources: uniqueResources, notes };
}

export async function searchSlumIndicatorsCkan(fetchImpl: FetchLike = fetch) {
  const notes: string[] = [];
  const datasets: HdxDatasetHit[] = [];
  const resources: HdxResourceHit[] = [];

  const slugUrl = `${CKAN_BASE}/package_show?id=housing-slums-world`;
  const slugRes = await fetchJson(slugUrl, fetchImpl);
  if (slugRes.ok && slugRes.json && typeof slugRes.json === "object") {
    const root = slugRes.json as Record<string, unknown>;
    const result = (root.result ?? root) as Record<string, unknown>;
    datasets.push(mapDataset(result, "ckan", "slug:housing-slums-world"));
    const rr = flattenToRecords(result.resources);
    rr.forEach((row) => {
      const mapped = mapResource(row, "ckan");
      if (mapped) resources.push(mapped);
    });
  } else {
    notes.push("CKAN slug housing-slums-world did not resolve; falling back to package search.");
  }

  if (!datasets.length) {
    const query = encodeURIComponent("organization:unhabitat housing slums informal settlements SDG 11.1.1");
    const searchUrl = `${CKAN_BASE}/package_search?q=${query}&rows=10`;
    const searchRes = await fetchJson(searchUrl, fetchImpl);
    if (searchRes.ok && searchRes.json && typeof searchRes.json === "object") {
      const root = searchRes.json as Record<string, unknown>;
      const result = (root.result ?? {}) as Record<string, unknown>;
      const pkgResults = flattenToRecords(result.results);
      for (const pkg of pkgResults) {
        if (!looksSlumLike(pkg)) continue;
        datasets.push(mapDataset(pkg, "ckan", "package_search"));
        const rr = flattenToRecords(pkg.resources);
        rr.forEach((row) => {
          const mapped = mapResource(row, "ckan");
          if (mapped) resources.push(mapped);
        });
      }
    }
  }

  const uniqueDatasets = Array.from(new Map(datasets.map((d) => [d.id, d])).values());
  const uniqueResources = Array.from(new Map(resources.map((r) => [r.url, r])).values());
  if (!uniqueDatasets.length) notes.push("CKAN returned no UN-Habitat slum/informal-settlement indicator datasets.");
  return { datasets: uniqueDatasets, resources: uniqueResources, notes };
}

export async function testUnHabitatHdxConnection(fetchImpl: FetchLike = fetch): Promise<HdxTestResult> {
  const notes: string[] = [
    "This data is contextual indicator data (country/city-level) unless geometry is explicitly provided.",
  ];

  const hapiProbe = await testHdxHapiConnection(fetchImpl);
  notes.push(...hapiProbe.notes);

  let hapiDatasets: HdxDatasetHit[] = [];
  let hapiResources: HdxResourceHit[] = [];
  if (hapiProbe.available) {
    const hapiSearch = await searchSlumIndicators(fetchImpl);
    hapiDatasets = hapiSearch.datasets;
    hapiResources = hapiSearch.resources;
    notes.push(...hapiSearch.notes);
  }

  const ckanSearch = await searchSlumIndicatorsCkan(fetchImpl);
  notes.push(...ckanSearch.notes);

  const datasetsFound = [...hapiDatasets, ...ckanSearch.datasets];
  const resourcesFound = [...hapiResources, ...ckanSearch.resources];

  let sampleRows: Array<Record<string, string>> = [];
  const csvResource = resourcesFound.find((r) => (r.format ?? "").toUpperCase().includes("CSV") || r.url.toLowerCase().includes(".csv"));
  if (csvResource) {
    try {
      sampleRows = await fetchCsvSampleRows(csvResource.url, fetchImpl);
      if (!sampleRows.length) notes.push("CSV resource reachable, but no sample rows could be parsed.");
    } catch {
      notes.push("Failed to fetch sample rows from candidate CSV resource.");
    }
  } else {
    notes.push("No CSV resource found for lightweight sample row preview.");
  }

  const uniqueDatasets = Array.from(new Map(datasetsFound.map((d) => [`${d.source}:${d.id}`, d])).values());
  const uniqueResources = Array.from(new Map(resourcesFound.map((r) => [r.url, r])).values());

  const hapiAvailable = hapiProbe.available;
  const ckanAvailable = ckanSearch.datasets.length > 0 || ckanSearch.resources.length > 0;
  const status: HdxTestResult["status"] =
    hapiAvailable && ckanAvailable
      ? "success"
      : hapiAvailable || ckanAvailable
        ? "partial"
        : "failed";

  return {
    status,
    hapiAvailable,
    ckanAvailable,
    datasetsFound: uniqueDatasets,
    resourcesFound: uniqueResources,
    sampleRows,
    notes,
  };
}
