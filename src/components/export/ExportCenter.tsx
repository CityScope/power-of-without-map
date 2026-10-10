"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Globe2, Layers, Map, PenLine, Table } from "lucide-react";
import {
  activeExportFilters,
  buildExportSearch,
  countryNames,
  DEFAULT_EXPORT_FILTERS,
  readExportRows,
  settlementMatchesExportFilters,
  type ExportCountRow,
  type ExportFilterInput,
} from "@/lib/exportQuery";

type FormatId = "geojson" | "csv" | "kml" | "shapefile" | "dxf";

const FORMATS: Record<
  FormatId,
  { name: string; file: string; action: string; endpoint: string; summary: string; uses: string[] }
> = {
  geojson: {
    name: "GeoJSON",
    file: "JSON response",
    action: "Download GeoJSON",
    endpoint: "/api/export/geojson",
    summary: "Geographic features for interactive maps and spatial analysis.",
    uses: ["Web mapping", "GIS applications", "GeoJSON-compatible analysis tools"],
  },
  csv: {
    name: "CSV",
    file: "settlements.csv",
    action: "Download CSV",
    endpoint: "/api/export/csv",
    summary: "Tabular information for spreadsheets and statistical analysis.",
    uses: ["Excel", "R", "Python", "Statistical analysis"],
  },
  kml: {
    name: "KML",
    file: "settlements.kml",
    action: "Download KML",
    endpoint: "/api/export/kml",
    summary: "Geographic information compatible with Google Earth and other mapping tools.",
    uses: ["Google Earth", "Geographic visualization", "Sharing mapped features"],
  },
  shapefile: {
    name: "Shapefile ZIP",
    file: "settlements-shapefile.zip",
    action: "Download Shapefile ZIP",
    endpoint: "/api/export/shapefile",
    summary: "Traditional geospatial format used by GIS applications.",
    uses: ["QGIS", "ArcGIS", "Geographic analysis workflows"],
  },
  dxf: {
    name: "DXF",
    file: "settlements.dxf",
    action: "Download DXF",
    endpoint: "/api/export/dxf",
    summary: "CAD-compatible geographic information for design and technical workflows.",
    uses: ["AutoCAD-compatible software", "Urban design", "Planning workflows"],
  },
};

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zinc-600 bg-zinc-950 px-3 text-base text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

export function ExportCenter() {
  const [filters, setFilters] = useState<ExportFilterInput>(DEFAULT_EXPORT_FILTERS);
  const [countrySearch, setCountrySearch] = useState("");
  const [rows, setRows] = useState<ExportCountRow[] | null>(null);
  const [rowsState, setRowsState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [format, setFormat] = useState<FormatId>("geojson");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const parsed = readExportRows(payload);
        if (!parsed) {
          setRowsState("unavailable");
          return;
        }
        setRows(parsed);
        setRowsState("ready");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setRowsState("unavailable");
      });
    return () => controller.abort();
  }, []);

  const countries = useMemo(() => countryNames(rows ?? []), [rows]);
  const visibleCountries = useMemo(() => {
    const needle = countrySearch.trim().toLowerCase();
    const matched = countries.filter((country) => !needle || country.toLowerCase().includes(needle));
    if (filters.country && !matched.includes(filters.country)) return [filters.country, ...matched];
    return matched;
  }, [countries, countrySearch, filters.country]);
  const search = buildExportSearch(filters);
  const selected = FORMATS[format];
  const matching = useMemo(() => {
    if (!rows) return null;
    return rows.filter((row) => settlementMatchesExportFilters(row, activeExportFilters(filters)));
  }, [filters, rows]);
  const scored = matching?.filter((row) => row.finalScore !== null).length;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-4xl">
          <p className="text-base font-medium uppercase tracking-[0.14em] text-amber-200">Download</p>
          <h1 className="mt-2 text-[2.25rem] font-semibold leading-tight text-white md:text-[2.625rem]">Export Data</h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-200">
            Download settlement information, geographic boundaries, and available indicators for research, mapping, and analysis.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-zinc-300">
            Choose the settlements you want to explore and select the format that best suits your work. Available data and completeness may vary between settlements.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="export-step-1">
          <StepLabel id="export-step-1" step="Step 1" title="Select your data" text="Choose which settlements and information you want to include." />
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3 className="text-2xl font-semibold text-white">Dataset scope</h3>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-zinc-600 px-4 text-base text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                  onClick={() => {
                    setFilters(DEFAULT_EXPORT_FILTERS);
                    setCountrySearch("");
                  }}
                >
                  Reset filters
                </button>
              </div>
              <p className="mt-3 text-base leading-relaxed text-zinc-400">
                The exporter accepts a country, a minimum and maximum Informality Score, and a minimum completeness. Atlas versus community is not a download filter.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-base text-zinc-200 md:col-span-2">
                  Find a country
                  <input
                    className={inputClass}
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                    placeholder="Type to narrow the list"
                    aria-label="Find a country"
                  />
                </label>
                <label className="block text-base text-zinc-200 md:col-span-2">
                  Country
                  <select
                    className={inputClass}
                    value={filters.country}
                    onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}
                  >
                    <option value="">All countries</option>
                    {visibleCountries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-base text-zinc-200">
                  Minimum Informality Score
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={filters.minScore}
                    onChange={(event) => setFilters((current) => ({ ...current, minScore: event.target.value }))}
                  />
                </label>
                <label className="block text-base text-zinc-200">
                  Maximum Informality Score
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={filters.maxScore}
                    onChange={(event) => setFilters((current) => ({ ...current, maxScore: event.target.value }))}
                  />
                </label>
                <label className="block text-base text-zinc-200 md:col-span-2">
                  Minimum data completeness
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={filters.minCompleteness}
                    onChange={(event) => setFilters((current) => ({ ...current, minCompleteness: event.target.value }))}
                  />
                </label>
              </div>
              <p className="mt-4 text-base leading-relaxed text-zinc-300">
                Higher scores indicate greater informality or deprivation. The scale is 0 to 1. Data completeness is the proportion of score indicators with answers, also from 0 to 1. It is not wizard progress.
              </p>
              <p className="mt-3 text-base leading-relaxed text-amber-100/90">
                A missing score is not zero. When a score or completeness limit is set, records without that stored value stay in the download. A stored zero is still zero and can be excluded by a higher minimum.
              </p>
              {rowsState === "loading" ? <p className="mt-3 text-base text-zinc-400">Loading country names…</p> : null}
              {rowsState === "unavailable" ? (
                <p className="mt-3 text-base text-zinc-400">The country list could not be loaded. All countries remains available, and a typed export is not offered because the API matches the stored name exactly.</p>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 md:p-6">
              <h3 className="text-2xl font-semibold text-white">Your export selection</h3>
              <dl className="mt-4 space-y-3 text-base">
                <div>
                  <dt className="text-zinc-400">Country</dt>
                  <dd className="text-lg text-white">{filters.country || "All countries"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Informality Score</dt>
                  <dd className="text-lg text-amber-200">
                    {filters.minScore || "0"}–{filters.maxScore || "1"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Minimum completeness</dt>
                  <dd className="text-lg text-white">{filters.minCompleteness || "0"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Dataset category</dt>
                  <dd className="text-lg text-white">All stored settlements that pass these filters</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Matching settlements</dt>
                  <dd className="text-lg text-white">{matching ? matching.length.toLocaleString() : rowsState === "loading" ? "Loading…" : "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">With a stored Informality Score</dt>
                  <dd className="text-lg text-white">{scored === undefined ? (rowsState === "loading" ? "Loading…" : "Unavailable") : scored.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">With geographic boundaries</dt>
                  <dd className="text-base leading-relaxed text-zinc-300">Not counted here. This page does not download the file to inspect geometry.</dd>
                </div>
              </dl>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-zinc-500">
                The count uses the exporter’s rules on the current settlement list. It is not a file preview, and it does not mean every row has a score.
              </p>
            </aside>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="export-step-2">
          <StepLabel id="export-step-2" step="Step 2" title="Choose your format" text="Select the file format that works best for your application." />
          <FormatGroup title="Mapping and GIS" text="Geographic features for maps and spatial software.">
            <FormatCard id="geojson" icon={<Map className="h-5 w-5" aria-hidden />} selected={format === "geojson"} onSelect={setFormat} />
            <FormatCard id="kml" icon={<Globe2 className="h-5 w-5" aria-hidden />} selected={format === "kml"} onSelect={setFormat} />
            <FormatCard id="shapefile" icon={<Layers className="h-5 w-5" aria-hidden />} selected={format === "shapefile"} onSelect={setFormat} />
          </FormatGroup>
          <FormatGroup title="Data analysis" text="A table, without boundary geometry.">
            <FormatCard id="csv" icon={<Table className="h-5 w-5" aria-hidden />} selected={format === "csv"} onSelect={setFormat} />
          </FormatGroup>
          <FormatGroup title="CAD and urban design" text="Drawing geometry for design software.">
            <FormatCard id="dxf" icon={<PenLine className="h-5 w-5" aria-hidden />} selected={format === "dxf"} onSelect={setFormat} />
          </FormatGroup>
          <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-base leading-relaxed text-zinc-300">
            DWG export is not currently available. DXF can be converted to DWG using compatible CAD software.
          </p>
        </section>

        <section className="mt-12 rounded-2xl border border-amber-300/30 bg-zinc-900/70 p-5 md:p-6" aria-labelledby="export-step-3">
          <StepLabel id="export-step-3" step="Step 3" title="Download" text="Review your selection and export the available data." />
          <p className="mt-4 text-lg text-white">
            {selected.name}
            <span className="mt-1 block text-base text-zinc-400">{selected.summary}</span>
          </p>
          <p className="mt-3 break-all text-[0.9375rem] leading-relaxed text-zinc-400">
            File: {selected.file}. The request is {`${selected.endpoint}${search}`}. The browser receives the file directly. This page does not confirm that a download finished.
          </p>
          <a
            href={`${selected.endpoint}${search}`}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-5 text-lg font-semibold text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            {selected.action}
          </a>
        </section>

        <section className="mt-12">
          <h2 className="text-[1.75rem] font-semibold text-white">What&apos;s included in the download?</h2>
          <div className="mt-4 space-y-3">
            <FieldList
              title="GeoJSON"
              items={[
                "Included only when a boundary is stored.",
                "Identification, name, city, country, area in square metres, and population.",
                "Informality Score, global percentile rank, completeness, and uncertainty. A missing number is written as null, not zero.",
                "The stored boundary geometry.",
                "Architecture, Populace, Site, questionnaire answers, atlas or community classification, and national UN-Habitat indicators are not included.",
              ]}
            />
            <FieldList
              title="CSV"
              items={[
                "Every settlement that passes the filters, including records without a boundary.",
                "Identification, name, city, country, area, population, and verification status.",
                "Informality Score, global percentile, completeness, and uncertainty. A missing number is a blank cell, not zero.",
                "Boundary geometry is omitted. Coordinates are not included.",
                "Architecture, Populace, Site, questionnaire answers, and national indicators are not columns.",
              ]}
            />
            <FieldList
              title="KML"
              items={[
                "Included only when a boundary is stored.",
                "Identification, name, city, country, score, percentile, and uncertainty.",
                "A missing score is passed as null, not zero. Completeness, area, and population are not included.",
                "The stored boundary geometry.",
              ]}
            />
            <FieldList
              title="Shapefile ZIP"
              items={[
                "A ZIP named settlements-shapefile.zip.",
                "For each geometry type present, the exporter writes .shp, .shx, .dbf, and a WGS 84 .prj inside a layers folder.",
                "Attributes are identification, name, city, country, score, percentile, and uncertainty.",
                "Records without a boundary are left out. A missing score is null, not zero.",
              ]}
            />
            <FieldList
              title="DXF"
              items={[
                "A drawing named settlements.dxf. There is no attribute table.",
                "Settlements need both a stored boundary and a centroid. Polygon and multipolygon outer rings are drawn, with a point and a text label at the centroid.",
                "The label contains the name, country, and score. A missing score is written as NA, not 0.",
                "Coordinates are the stored longitude and latitude. This export does not add a separate projection.",
              ]}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-zinc-800 p-5 text-base leading-relaxed text-zinc-300">
            <p>Atlas reference records may have a location and no questionnaire. Community records may have an incomplete profile.</p>
            <p className="mt-2">Site is contextual and is not a column in these files. National UN-Habitat indicators are a separate dataset and are not attached to settlement rows.</p>
            <p className="mt-2">Geographic detail varies with the boundary that was stored.</p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 md:p-8">
          <h2 className="text-[1.75rem] font-semibold text-white">Using and citing the data</h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-300">
            These datasets combine different sources of settlement information. Please consider their origin, completeness, geographic coverage, and methodological limitations when using them.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
            This application does not store one license for every downloaded row. Atlas locations, community profiles, and UN-Habitat statistics can have different conditions. Where those conditions are not recorded here, consult the original source.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-lg">
            <Link href="/methodology" className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4">
              Methodology
            </Link>
            <Link href="/data-import" className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4">
              Data sources and imports
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function StepLabel({ id, step, title, text }: { id: string; step: string; title: string; text: string }) {
  return (
    <div>
      <p className="text-base font-medium uppercase tracking-[0.12em] text-amber-200">{step}</p>
      <h2 id={id} className="mt-1 text-[1.75rem] font-semibold leading-tight text-white md:text-[1.85rem]">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-lg leading-relaxed text-zinc-300">{text}</p>
    </div>
  );
}

function FormatGroup({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-1 text-base text-zinc-400">{text}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function FormatCard({
  id,
  icon,
  selected,
  onSelect,
}: {
  id: FormatId;
  icon: ReactNode;
  selected: boolean;
  onSelect: (id: FormatId) => void;
}) {
  const format = FORMATS[id];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      className={`rounded-2xl border p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${selected ? "border-amber-300 bg-amber-400/10" : "border-zinc-800 bg-zinc-900/70"}`}
    >
      <span className="flex items-center gap-2 text-[1.35rem] font-semibold text-white md:text-2xl">
        <span className="text-amber-200">{icon}</span>
        {format.name}
      </span>
      <span className="mt-2 block text-base leading-relaxed text-zinc-300">{format.summary}</span>
      <span className="mt-3 block text-[0.9375rem] leading-relaxed text-zinc-400">Best for {format.uses.join(", ")}.</span>
    </button>
  );
}

function FieldList({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <summary className="cursor-pointer text-xl font-semibold text-white">{title}</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}
