import Papa from "papaparse";
import {
  HDX_CSV_PROPORTION_URL,
  HDX_CSV_TOTAL_URL,
  INDICATOR_PROPORTION_URBAN_SLUMS,
  INDICATOR_TOTAL_SLUM_POPULATION,
  UN_HABITAT_HDX_SOURCE,
} from "@/lib/hdxUnHabitatImportConstants";

type FetchLike = typeof fetch;

export type HdxCkanRow = Record<string, string>;

const COL = {
  countryCode: "Country or Territory Name",
  countryName: "Country or Territory Name2",
  region: "SDG Region",
  subRegion: "SDG Sub-Region",
  unit: "Data Units",
  year: "Data Reference Year",
  footnote: "Footnote",
} as const;

function col(row: HdxCkanRow, name: string): string {
  const v = row[name];
  return v === undefined || v === null ? "" : String(v).trim();
}

export function pickProportionValueColumn(headers: string[]): string {
  const h = headers.find((key) => {
    const k = key.toLowerCase();
    return k.includes("proportion of urban") && k.includes("slum") && k.includes("informal");
  });
  return h ?? "Proportion of urban population living in slums or informal settlements (%) (a)";
}

export function pickTotalValueColumn(headers: string[]): string {
  const h = headers.find((key) => {
    const k = key.toLowerCase();
    return k.includes("total") && (k.includes("slum") || k.includes("informal") || k.includes("population in slum"));
  });
  return h ?? "Total population living in slums and informal settlements (a)";
}

export function parseHdxCkanCsvString(csv: string): { rows: HdxCkanRow[]; headers: string[] } {
  const parsed = Papa.parse<HdxCkanRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (parsed.errors.length) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV parse error: ${msg}`);
  }
  const headers = parsed.meta.fields?.filter(Boolean) as string[] | undefined;
  if (!headers?.length) throw new Error("CSV has no header row");
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
  return { rows, headers };
}

export type MappedHdxRow = {
  source: string;
  countryCode: string;
  countryName: string;
  city: null;
  region: string;
  subRegion: string;
  indicatorName: string;
  indicatorValue: string;
  unit: string;
  year: number;
  sourceUrl: string;
  footnote: string | null;
  rawJson: string;
};

export function mapHdxCkanRow(
  row: HdxCkanRow,
  valueColumn: string,
  indicatorName: string,
  sourceUrl: string,
): MappedHdxRow | null {
  const name = col(row, COL.countryName);
  if (!name) return null;
  const valueRaw = col(row, valueColumn);
  if (valueRaw === "") return null;
  const y = Number(col(row, COL.year));
  if (!Number.isFinite(y)) return null;
  return {
    source: UN_HABITAT_HDX_SOURCE,
    countryCode: col(row, COL.countryCode),
    countryName: name,
    city: null,
    region: col(row, COL.region),
    subRegion: col(row, COL.subRegion),
    indicatorName,
    indicatorValue: valueRaw,
    unit: col(row, COL.unit),
    year: y,
    sourceUrl,
    footnote: col(row, COL.footnote) || null,
    rawJson: JSON.stringify(row),
  };
}

export async function downloadCkanCsv(url: string, fetchImpl: FetchLike) {
  const res = await fetchImpl(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to download CSV: ${res.status} ${url}`);
  return res.text();
}

export async function buildHdxUnHabitatImportPayload(fetchImpl: FetchLike = fetch) {
  const [proportionCsv, totalCsv] = await Promise.all([
    downloadCkanCsv(HDX_CSV_PROPORTION_URL, fetchImpl),
    downloadCkanCsv(HDX_CSV_TOTAL_URL, fetchImpl),
  ]);
  const prop = parseHdxCkanCsvString(proportionCsv);
  const tot = parseHdxCkanCsvString(totalCsv);
  const propValueCol = pickProportionValueColumn(prop.headers);
  const totValueCol = pickTotalValueColumn(tot.headers);
  const mapped: MappedHdxRow[] = [];
  for (const r of prop.rows) {
    const m = mapHdxCkanRow(r, propValueCol, INDICATOR_PROPORTION_URBAN_SLUMS, HDX_CSV_PROPORTION_URL);
    if (m) mapped.push(m);
  }
  for (const r of tot.rows) {
    const m = mapHdxCkanRow(r, totValueCol, INDICATOR_TOTAL_SLUM_POPULATION, HDX_CSV_TOTAL_URL);
    if (m) mapped.push(m);
  }
  return { mapped, proportionColumn: propValueCol, totalColumn: totValueCol };
}
