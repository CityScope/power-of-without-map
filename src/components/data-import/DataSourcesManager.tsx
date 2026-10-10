"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarRange, CircleAlert, Download, Globe2, Layers, Plug } from "lucide-react";
import type { HdxTestResult } from "@/lib/hdxUnHabitatClient";
import {
  HDX_CSV_PROPORTION_URL,
  HDX_CSV_TOTAL_URL,
  INDICATOR_PROPORTION_URBAN_SLUMS,
  INDICATOR_TOTAL_SLUM_POPULATION,
  UN_HABITAT_HDX_SOURCE,
} from "@/lib/hdxUnHabitatImportConstants";
import { ATLAS_ARCGIS_APP_ITEM_URL, ATLAS_SOURCE_URL } from "@/lib/atlasArcgisDiscovery";
import { summarizeImportInventory, type ImportInventory } from "@/lib/dataImportInventory";

type ImportPayload = {
  ok?: boolean;
  rowsUpserted?: number;
  rowsPrepared?: number;
  yearsCovered?: number[];
  countriesCovered?: number;
  error?: string;
};

type AtlasDiscoverPayload = {
  ok?: boolean;
  appItemFound?: boolean;
  webmapId?: string | null;
  layersFound?: number;
  featureServicesFound?: number;
  mapServicesFound?: number;
  layerItemIds?: string[];
  featureServerUrls?: string[];
  mapServerUrls?: string[];
  downloadableResources?: string[];
  probedFeatureServiceLayers?: string[];
  importableRecordsCount?: number;
  invalidGeometrySkips?: number;
  importedRecords?: number;
  importSkipped?: string[];
  dbAtlasReference?: { true: number; false: number } | null;
  noPublicLayerMessage?: string | null;
  notes?: string[];
  error?: string;
};

type InventoryState = { status: "loading" } | { status: "ready"; inventory: ImportInventory } | { status: "unavailable" };

const actionClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60";

export function DataSourcesManager() {
  const [inventory, setInventory] = useState<InventoryState>({ status: "loading" });
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRaw, setImportRaw] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [result, setResult] = useState<HdxTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testRaw, setTestRaw] = useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<AtlasDiscoverPayload | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverRaw, setDiscoverRaw] = useState<string | null>(null);
  const [confirmDiscover, setConfirmDiscover] = useState(false);
  const atlasRun = useRef(false);
  const importRun = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const summary = summarizeImportInventory(payload);
        setInventory(summary ? { status: "ready", inventory: summary } : { status: "unavailable" });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setInventory({ status: "unavailable" });
      });
    return () => controller.abort();
  }, []);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setTestRaw(null);
    try {
      const res = await fetch("/api/data-sources/hdx-test", { cache: "no-store" });
      const text = await res.text();
      setTestRaw(text);
      const payload = (text ? JSON.parse(text) : null) as HdxTestResult | null;
      setResult(payload);
      if (!res.ok) setError(`The connection check failed (${res.status}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to test HDX connection.");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (importRun.current) return;
    importRun.current = true;
    setConfirmImport(false);
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);
    setImportRaw(null);
    try {
      const res = await fetch("/api/import/hdx-unhabitat", { method: "POST" });
      const text = await res.text();
      setImportRaw(text);
      const json = (text ? JSON.parse(text) : null) as ImportPayload;
      setImportResult(json);
      if (!res.ok || json?.ok === false) {
        setImportError(json?.error ?? `Import failed (${res.status})`);
        return;
      }
      const refresh = await fetch("/api/analytics");
      if (refresh.ok) {
        const summary = summarizeImportInventory(await refresh.json());
        if (summary) setInventory({ status: "ready", inventory: summary });
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      importRun.current = false;
      setImportLoading(false);
    }
  };

  const runAtlasDiscover = async () => {
    if (atlasRun.current) return;
    atlasRun.current = true;
    setConfirmDiscover(false);
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoverResult(null);
    setDiscoverRaw(null);
    try {
      const res = await fetch("/api/data-sources/atlas-arcgis-discover", { method: "POST" });
      const text = await res.text();
      setDiscoverRaw(text);
      const json = (text ? JSON.parse(text) : null) as AtlasDiscoverPayload;
      setDiscoverResult(json);
      if (json?.invalidGeometrySkips != null) {
        try {
          sessionStorage.setItem("atlasDebugInvalidSkips", String(json.invalidGeometrySkips));
        } catch {
          // ignore
        }
      }
      if (!res.ok || json?.ok === false) {
        setDiscoverError(json?.error ?? `Discovery failed (${res.status})`);
        return;
      }
      if (json?.dbAtlasReference) {
        setInventory((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                inventory: {
                  ...current.inventory,
                  atlasSettlements: json.dbAtlasReference?.true ?? current.inventory.atlasSettlements,
                  communitySettlements: json.dbAtlasReference?.false ?? current.inventory.communitySettlements,
                },
              }
            : current,
        );
      }
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      atlasRun.current = false;
      setDiscoverLoading(false);
    }
  };

  const counts = inventory.status === "ready" ? inventory.inventory : null;
  const writeBusy = discoverLoading || importLoading;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-4xl">
          <p className="text-base font-medium uppercase tracking-[0.14em] text-amber-200">Data</p>
          <h1 className="mt-2 text-[2.25rem] font-semibold leading-tight text-white md:text-[2.625rem]">Data Sources & Imports</h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-200">
            Explore the data sources behind the Atlas of Informal Settlements, understand their coverage, and manage available imports.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-zinc-300">
            The platform combines geographic reference data, community-contributed settlement profiles, and national contextual indicators. Each source provides different information and serves a different purpose.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Data currently stored">
          <Metric
            label="Atlas reference settlements"
            value={countLabel(inventory, counts?.atlasSettlements)}
            note="Imported reference locations. These records are not community questionnaires."
          />
          <Metric
            label="Community settlements"
            value={countLabel(inventory, counts?.communitySettlements)}
            note="Profiles added through the settlement questionnaire, not through the buttons on this page."
          />
          <Metric
            label="National context"
            value={countLabel(inventory, counts?.nationalCountries)}
            note="Countries with a stored UN-Habitat / HDX indicator. These are national statistics, not settlement polygons."
          />
        </section>
        {inventory.status === "unavailable" ? (
          <p className="mt-3 text-base text-zinc-400">Stored counts could not be loaded. Import actions below still use the existing services.</p>
        ) : null}

        <section className="mt-10">
          <h2 className="text-[1.75rem] font-semibold text-white">How an import works</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Concept icon={<Plug className="h-5 w-5" aria-hidden />} title="Test connection" text="Check whether the external data service is accessible. This does not store records." />
            <Concept icon={<Layers className="h-5 w-5" aria-hidden />} title="Discover data" text="Identify available layers, resources, and metadata." />
            <Concept icon={<Download className="h-5 w-5" aria-hidden />} title="Import data" text="Retrieve and store records using the existing import process." />
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <TypeCard title="Atlas reference data" items={["Settlement locations", "Geographic boundaries where the source provides them", "Imported reference attributes", "A spatial representation of documented settlements"]} />
          <TypeCard title="Community-contributed data" items={["Community-reported settlement information", "Questionnaire responses", "Informality indicators", "Calculated informality profiles where answers are sufficient"]} />
          <TypeCard title="UN-Habitat national context" items={["Country-level contextual statistics", "National slum population shares", "National slum population counts where the file includes them", "Observation years and national geographic coverage"]} />
        </section>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          These sources are not equivalent measurements. UN-Habitat national indicators do not calculate a settlement Informality Score, and they do not provide individual settlement polygons.
        </p>

        <div className="mt-10 grid gap-6">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
            <p className="text-base font-medium uppercase tracking-[0.12em] text-amber-200">Geospatial reference data</p>
            <h2 className="mt-2 text-[1.65rem] font-semibold text-white md:text-[1.85rem]">Atlas of Informality / ArcGIS</h2>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200">
              This source provides geographic information about documented informal settlements, including locations, boundaries, and available spatial attributes.
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Fact term="Source name" detail="Atlas of Informality" />
              <Fact term="Source type" detail="ArcGIS" />
              <Fact term="Source URL" detail={<External href={ATLAS_SOURCE_URL}>{ATLAS_SOURCE_URL}</External>} />
              <Fact term="ArcGIS item" detail={<External href={ATLAS_ARCGIS_APP_ITEM_URL}>Public ArcGIS item</External>} />
              <Fact term="Imported settlement records" detail={countLabel(inventory, counts?.atlasSettlements)} />
              <Fact term="Current source status" detail={discoverResult ? "Checked in this session" : "Not checked in this session"} />
            </dl>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">
              Layer names, geometry types, and a stored retrieval date are not included in the current response. Available layers and record counts appear here after discovery. The application does not keep a separate import log.
            </p>
            <p className="mt-3 text-base leading-relaxed text-zinc-300">
              Discover available ArcGIS layers and attempt import where supported by the existing service.
            </p>

            {confirmDiscover ? (
              <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-4" role="region" aria-label="Confirm Atlas discovery and import">
                <p className="text-base leading-relaxed text-amber-50">
                  This contacts the public Atlas ArcGIS service. When that service exposes records, the existing process stores them as atlas reference settlements.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={`${actionClass} bg-amber-300 text-zinc-950`} onClick={() => void runAtlasDiscover()}>
                    Continue
                  </button>
                  <button type="button" className={`${actionClass} border border-zinc-600 text-zinc-100`} onClick={() => setConfirmDiscover(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`${actionClass} mt-4 bg-amber-300 text-zinc-950`}
                onClick={() => setConfirmDiscover(true)}
                disabled={discoverLoading || writeBusy}
              >
                <Layers className="h-5 w-5" aria-hidden />
                {discoverLoading ? "Discovering layers and importing exposed records…" : "Discover Atlas ArcGIS Layers"}
              </button>
            )}
            {discoverLoading ? <p className="mt-3 text-base text-zinc-300" role="status">Contacting ArcGIS and running the existing import when records are exposed. No percentage is available.</p> : null}

            {discoverError ? (
              <Failure
                title="Atlas discovery did not finish"
                message={discoverError}
                raw={discoverRaw}
                onRetry={() => setConfirmDiscover(true)}
              />
            ) : null}
            {discoverResult && !discoverError ? <AtlasResult payload={discoverResult} raw={discoverRaw} /> : null}
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
            <p className="text-base font-medium uppercase tracking-[0.12em] text-violet-300">National contextual indicators</p>
            <h2 className="mt-2 text-[1.65rem] font-semibold text-white md:text-[1.85rem]">UN-Habitat / HDX</h2>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200">
              UN-Habitat / HDX provides country-level indicators describing slum and informal settlement conditions. These are national statistics, not individual settlement boundaries.
            </p>
            <p className="mt-2 text-base text-zinc-400">United Nations data, published through the Humanitarian Data Exchange. This page does not describe a project partnership.</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Fact term="Source organization" detail="UN-Habitat, via HDX" />
              <Fact term="Dataset label in this atlas" detail={UN_HABITAT_HDX_SOURCE} />
              <Fact term="Imported countries" detail={countLabel(inventory, counts?.nationalCountries)} />
              <Fact
                term="Latest stored observation years"
                detail={
                  counts?.latestObservationYearMin == null
                    ? inventory.status === "loading"
                      ? "Loading…"
                      : "Not available"
                    : counts.latestObservationYearMin === counts.latestObservationYearMax
                      ? String(counts.latestObservationYearMin)
                      : `${counts.latestObservationYearMin}–${counts.latestObservationYearMax}`
                }
              />
            </dl>
            <div className="mt-4 space-y-2 text-base leading-relaxed text-zinc-300">
              <p>{INDICATOR_PROPORTION_URBAN_SLUMS}</p>
              <p>
                <External href={HDX_CSV_PROPORTION_URL}>Proportion indicator file on HDX</External>
              </p>
              <p className="pt-2">{INDICATOR_TOTAL_SLUM_POPULATION}</p>
              <p>
                <External href={HDX_CSV_TOTAL_URL}>Population indicator file on HDX</External>
              </p>
            </div>
            <p className="mt-3 text-base text-zinc-400">Units and footnotes come from the HDX files. They are shown when a connection check or import returns them.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={`${actionClass} border border-zinc-500 text-zinc-50`} onClick={() => void runTest()} disabled={loading}>
                <Plug className="h-5 w-5" aria-hidden />
                {loading ? "Checking the HDX service…" : "Test Connection"}
              </button>
              {confirmImport ? null : (
                <button
                  type="button"
                  className={`${actionClass} bg-white text-zinc-950`}
                  onClick={() => setConfirmImport(true)}
                  disabled={importLoading || writeBusy}
                >
                  <Download className="h-5 w-5" aria-hidden />
                  {importLoading ? "Importing national indicators…" : "Import UN-Habitat / HDX Indicators"}
                </button>
              )}
            </div>
            {confirmImport ? (
              <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-4" role="region" aria-label="Confirm UN-Habitat import">
                <p className="text-base leading-relaxed text-amber-50">
                  This downloads the UN-Habitat / HDX indicator files and stores country-level contextual indicators. It does not create settlement boundaries.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={`${actionClass} bg-white text-zinc-950`} onClick={() => void runImport()}>
                    Continue import
                  </button>
                  <button type="button" className={`${actionClass} border border-zinc-600 text-zinc-100`} onClick={() => setConfirmImport(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {loading ? <p className="mt-3 text-base text-zinc-300" role="status">Checking whether HDX responds. This does not store records.</p> : null}
            {importLoading ? <p className="mt-3 text-base text-zinc-300" role="status">Downloading the indicator files and storing country records. No percentage is available.</p> : null}

            {error ? <Failure title="The HDX connection check failed" message={error} raw={testRaw} onRetry={() => void runTest()} /> : null}
            {result && !error ? <HdxTestResultView result={result} raw={testRaw} /> : null}
            {importError ? <Failure title="The UN-Habitat / HDX import failed" message={importError} raw={importRaw} onRetry={() => setConfirmImport(true)} /> : null}
            {importResult && !importError ? <HdxImportResult payload={importResult} raw={importRaw} /> : null}
          </article>
        </div>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 md:p-8">
          <h2 className="text-[1.75rem] font-semibold text-white">Understanding Our Data Sources</h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Provenance shows where a figure comes from, when it was observed, and what it cannot represent.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Provenance
              icon={<Globe2 className="h-5 w-5" aria-hidden />}
              title="Geographic coverage"
              text={
                counts
                  ? `Settlement records currently name ${counts.settlementCountries} countries. ${counts.settlementsWithoutCountry} settlements have no country stored and are not assigned one. National indicators are stored for ${counts.nationalCountries} countries.`
                  : "Country coverage appears when the stored settlement and indicator lists can be read."
              }
            />
            <Provenance
              icon={<CalendarRange className="h-5 w-5" aria-hidden />}
              title="Temporal coverage"
              text={
                counts?.latestObservationYearMin == null
                  ? "No observation year is available until national indicators are stored. Settlement records on this page do not carry a publication year."
                  : `The latest stored national observations fall in ${counts.latestObservationYearMin === counts.latestObservationYearMax ? counts.latestObservationYearMax : `${counts.latestObservationYearMin}–${counts.latestObservationYearMax}`}. That range is the years currently saved, not a claim that every year in between was imported.`
              }
            />
            <Provenance
              icon={<Layers className="h-5 w-5" aria-hidden />}
              title="Source and methodology"
              text="Atlas locations come from the Atlas of Informality ArcGIS service. National figures are UN-Habitat statistics distributed on HDX. Community profiles are calculated from questionnaire answers with the atlas scoring method."
            />
            <Provenance
              icon={<CircleAlert className="h-5 w-5" aria-hidden />}
              title="Limitations"
              text="National UN-Habitat statistics provide contextual information, but they do not describe the conditions of individual settlement boundaries. Atlas reference settlements do not, by themselves, produce an Informality Score."
            />
          </div>
          <p className="mt-6 text-base leading-relaxed text-zinc-400">
            Completed imports are not stored as a history, so this page cannot list past runs. A preview of ArcGIS layers before import is not available: the current Atlas action discovers and imports together.
          </p>
          <p className="mt-4 text-lg">
            <Link href="/methodology" className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4">
              Read the methodology
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function countLabel(state: InventoryState, value: number | undefined) {
  if (state.status === "loading") return "Loading…";
  if (state.status === "unavailable" || value === undefined) return "Unavailable";
  return value.toLocaleString();
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  const numeric = /^\d/.test(value);
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-base font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <p className={`mt-3 text-4xl font-semibold tabular-nums leading-none md:text-[2.75rem] ${numeric ? "text-amber-300" : "text-white"}`}>{value}</p>
      <p className="mt-3 text-base leading-relaxed text-zinc-400">{note}</p>
    </article>
  );
}

function Concept({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <span className="text-amber-200">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-base leading-relaxed text-zinc-300">{text}</p>
    </article>
  );
}

function TypeCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function Fact({ term, detail }: { term: string; detail: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
      <dt className="text-[0.9375rem] uppercase tracking-wide text-zinc-500">{term}</dt>
      <dd className="mt-1 text-base text-zinc-100">{detail}</dd>
    </div>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all text-amber-200 underline decoration-amber-300/40 underline-offset-4">
      {children}
    </a>
  );
}

function Provenance({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-xl border border-zinc-800 p-4">
      <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
        <span className="text-amber-200">{icon}</span>
        {title}
      </h3>
      <p className="mt-2 text-base leading-relaxed text-zinc-300">{text}</p>
    </article>
  );
}

function Failure({ title, message, raw, onRetry }: { title: string; message: string; raw: string | null; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-rose-800/70 bg-rose-950/30 p-4" role="alert">
      <p className="text-lg font-semibold text-rose-100">{title}</p>
      <p className="mt-2 text-base text-rose-50">{message}</p>
      <button type="button" className={`${actionClass} mt-3 border border-rose-300/50 text-rose-50`} onClick={onRetry}>
        Try again
      </button>
      {raw ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-base text-rose-100">Technical details</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[0.9375rem] text-rose-50/90">{raw}</pre>
        </details>
      ) : null}
    </div>
  );
}

function AtlasResult({ payload, raw }: { payload: AtlasDiscoverPayload; raw: string | null }) {
  return (
    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
      <p className="text-lg font-semibold text-white">Atlas service response</p>
      <p className="mt-2 text-base text-zinc-300">
        {typeof payload.importedRecords === "number"
          ? `Imported records reported by this run: ${payload.importedRecords.toLocaleString()}.`
          : "This response did not include an imported-record count."}
      </p>
      {payload.noPublicLayerMessage ? <p className="mt-3 text-base leading-relaxed text-amber-100">{payload.noPublicLayerMessage}</p> : null}
      <dl className="mt-4 grid gap-2 text-base text-zinc-200 sm:grid-cols-2">
        <div>App item found: {payload.appItemFound ? "yes" : "no"}</div>
        <div>Web map: {payload.webmapId ?? "none"}</div>
        <div>Layers found: {payload.layersFound ?? "not reported"}</div>
        <div>Feature services: {payload.featureServicesFound ?? "not reported"}</div>
        <div>Map services: {payload.mapServicesFound ?? "not reported"}</div>
        <div>Importable records: {payload.importableRecordsCount ?? "not reported"}</div>
        <div>Invalid geometries skipped: {payload.invalidGeometrySkips ?? "not reported"}</div>
        <div>Records skipped: {payload.importSkipped?.length ?? "not reported"}</div>
      </dl>
      {payload.dbAtlasReference ? (
        <p className="mt-3 text-base text-zinc-300">
          Database after this response: {payload.dbAtlasReference.true.toLocaleString()} atlas references and {payload.dbAtlasReference.false.toLocaleString()} other settlements.
        </p>
      ) : null}
      <UrlList title="Feature service URLs" urls={payload.featureServerUrls} />
      <UrlList title="Map service URLs" urls={payload.mapServerUrls} />
      <UrlList title="Probed feature layers" urls={payload.probedFeatureServiceLayers} />
      <UrlList title="Downloadable resources" urls={payload.downloadableResources} />
      <StringList title="Layer item identifiers" items={payload.layerItemIds} />
      <StringList title="Notes" items={payload.notes} />
      <StringList title="Skipped record notes" items={payload.importSkipped} />
      {raw ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-base text-zinc-300">Full response</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[0.9375rem] text-zinc-400">{raw}</pre>
        </details>
      ) : null}
    </div>
  );
}

function HdxTestResultView({ result, raw }: { result: HdxTestResult; raw: string | null }) {
  return (
    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
      <p className="text-lg font-semibold text-white">Connection check</p>
      <p className="mt-2 text-base text-zinc-300">
        Status: {result.status}. HAPI {result.hapiAvailable ? "responded" : "did not respond"}. CKAN {result.ckanAvailable ? "responded" : "did not respond"}. This check did not store records.
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer text-base font-medium text-zinc-100">Datasets found ({result.datasetsFound.length})</summary>
        <ul className="mt-2 space-y-2">
          {result.datasetsFound.length === 0 ? <li className="text-base text-zinc-400">None returned.</li> : null}
          {result.datasetsFound.map((dataset) => (
            <li key={`${dataset.source}-${dataset.id}`} className="rounded-lg border border-zinc-800 px-3 py-2 text-base">
              <p className="text-white">{dataset.title}</p>
              <p className="text-zinc-400">
                {dataset.source}
                {dataset.organization ? ` · ${dataset.organization}` : ""}
                {dataset.id ? ` · ${dataset.id}` : ""}
              </p>
              {dataset.url ? <External href={dataset.url}>{dataset.url}</External> : null}
            </li>
          ))}
        </ul>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-base font-medium text-zinc-100">Resources found ({result.resourcesFound.length})</summary>
        <ul className="mt-2 space-y-2">
          {result.resourcesFound.length === 0 ? <li className="text-base text-zinc-400">None returned.</li> : null}
          {result.resourcesFound.map((resource) => (
            <li key={resource.url} className="rounded-lg border border-zinc-800 px-3 py-2 text-base">
              <p className="text-white">{resource.name}</p>
              <p className="text-zinc-400">
                {resource.source}
                {resource.format ? ` · ${resource.format}` : ""}
              </p>
              <External href={resource.url}>{resource.url}</External>
            </li>
          ))}
        </ul>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-base font-medium text-zinc-100">Sample rows ({result.sampleRows.length})</summary>
        <div className="mt-2 space-y-3">
          {result.sampleRows.length === 0 ? <p className="text-base text-zinc-400">No sample rows were returned.</p> : null}
          {result.sampleRows.slice(0, 3).map((row, index) => (
            <dl key={index} className="rounded-lg border border-zinc-800 px-3 py-2 text-base">
              {Object.entries(row).map(([key, value]) => (
                <div key={key} className="grid gap-1 border-t border-zinc-800 py-1 first:border-t-0 sm:grid-cols-[12rem_1fr]">
                  <dt className="text-zinc-400">{key}</dt>
                  <dd className="text-zinc-100">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          ))}
          {result.sampleRows.length > 3 ? <p className="text-base text-zinc-400">Showing 3 of {result.sampleRows.length} sample rows from the connection check.</p> : null}
        </div>
      </details>
      <StringList title="Notes" items={result.notes} />
      {raw ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-base text-zinc-300">Technical details</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[0.9375rem] text-zinc-400">{raw}</pre>
        </details>
      ) : null}
    </div>
  );
}

function HdxImportResult({ payload, raw }: { payload: ImportPayload; raw: string | null }) {
  const stored = typeof payload.rowsUpserted === "number";
  return (
    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
      <p className="text-lg font-semibold text-white">Import response</p>
      <p className="mt-2 text-base text-zinc-300">
        {stored
          ? `Rows upserted: ${payload.rowsUpserted?.toLocaleString()}. A successful response reports how many indicator rows the existing process wrote.`
          : "The service responded without a row count, so this page does not assume records were stored."}
      </p>
      <dl className="mt-3 space-y-1 text-base text-zinc-200">
        <div>Rows prepared: {payload.rowsPrepared ?? "not reported"}</div>
        <div>Countries covered by this file: {payload.countriesCovered ?? "not reported"}</div>
        <div>
          Years covered:{" "}
          {payload.yearsCovered?.length
            ? `${payload.yearsCovered[0]}–${payload.yearsCovered[payload.yearsCovered.length - 1]} (${payload.yearsCovered.length} years)`
            : "not reported"}
        </div>
      </dl>
      {raw ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-base text-zinc-300">Technical details</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-[0.9375rem] text-zinc-400">{raw}</pre>
        </details>
      ) : null}
    </div>
  );
}

function UrlList({ title, urls }: { title: string; urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-base font-medium text-zinc-100">
        {title} ({urls.length})
      </summary>
      <ul className="mt-2 space-y-1 text-base">
        {urls.map((url) => (
          <li key={url}>
            <External href={url}>{url}</External>
          </li>
        ))}
      </ul>
    </details>
  );
}

function StringList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-base font-medium text-zinc-100">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-zinc-300">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="break-all">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
