"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, LocateFixed, Plus } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { DynamicSettlementMap } from "@/components/MapClient";
import { toAreaUnits } from "@/lib/geo";
import { settlementAreaM2 } from "@/lib/settlementMapBubble";
import { buildSettlementMapLayerModel } from "@/lib/settlementMapLayers";
import { SettlementRecord } from "@/types/settlement";
import type { UnHabitatNationalMapPayload } from "@/types/unhabitatMap";

type LayerState = {
  showAtlas: boolean;
  setShowAtlas: (v: boolean) => void;
  showCommunity: boolean;
  setShowCommunity: (v: boolean) => void;
  showUnHabitatContext: boolean;
  setShowUnHabitatContext: (v: boolean) => void;
};

function LayerCheckboxes({
  showAtlas,
  setShowAtlas,
  showCommunity,
  setShowCommunity,
  showUnHabitatContext,
  setShowUnHabitatContext,
}: LayerState) {
  return (
    <>
      <h2 className="text-xl font-semibold text-white">Layers</h2>
      <div className="mt-4 space-y-3.5 text-lg leading-snug text-zinc-100">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-amber-400"
            checked={showAtlas}
            onChange={(e) => setShowAtlas(e.target.checked)}
          />
          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-amber-200 bg-amber-300" />
          <span>Atlas / reference settlements</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-emerald-400"
            checked={showCommunity}
            onChange={(e) => setShowCommunity(e.target.checked)}
          />
          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-emerald-200 bg-emerald-400" />
          <span>Community settlements</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-blue-400"
            checked={showUnHabitatContext}
            onChange={(e) => setShowUnHabitatContext(e.target.checked)}
            aria-label="Show UN-Habitat national context"
          />
          <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-sky-200 bg-sky-500" />
          <span>UN-Habitat national context</span>
        </label>
      </div>
    </>
  );
}

function LegendBlock() {
  return (
    <>
      <h2 className="text-xl font-semibold text-white">Legend</h2>
      <div className="mt-4 space-y-3.5 text-lg text-zinc-100">
        <p className="flex items-center gap-3">
          <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-amber-200 bg-amber-300/80" />
          Atlas / reference settlements
        </p>
        <p className="flex items-center gap-3">
          <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-emerald-200 bg-emerald-400" />
          Community settlements
        </p>
        <p className="flex items-center gap-3 text-base leading-snug text-zinc-200">
          <span className="inline-flex items-end gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-zinc-200" />
            <span className="inline-block h-4 w-4 rounded-full border-2 border-zinc-100" />
          </span>
          Bubble size follows settlement area. A stronger center shows a higher stored Informality Score.
        </p>
        <div>
          <p className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-sky-200 bg-sky-500" />
            UN-Habitat national context
          </p>
          <div className="mt-2 w-full">
            <div className="mb-1 flex items-center justify-between text-base text-zinc-200">
              <span>0</span>
              <span>100</span>
            </div>
            <div className="h-2.5 w-full rounded-full border border-zinc-600 bg-gradient-to-r from-zinc-500 to-violet-500" />
          </div>
          <p className="mt-2 text-base leading-snug text-zinc-200">UN-Habitat layer based on United Nations official data.</p>
        </div>
      </div>
    </>
  );
}

const primaryAction =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-lg font-semibold text-zinc-950 shadow-lg shadow-black/40 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";
const secondaryAction =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-500 bg-zinc-950/90 px-5 py-3 text-lg text-white shadow-lg shadow-black/40 backdrop-blur transition hover:border-zinc-300 hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
const atlasAction =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/70 bg-zinc-950/90 px-5 py-3 text-lg font-medium text-amber-200 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

const SHOW_ATLAS_DEBUG =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHOW_ATLAS_DEBUG === "true";

export function MapExperience() {
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [selected, setSelected] = useState<SettlementRecord | null>(null);
  const [zoomAtlasTrigger, setZoomAtlasTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnHabitatContext, setShowUnHabitatContext] = useState(false);
  const [showAtlas, setShowAtlas] = useState(true);
  const [showCommunity, setShowCommunity] = useState(true);
  const [unHabitatNational, setUnHabitatNational] = useState<UnHabitatNationalMapPayload | null>(null);
  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settlements", { cache: "no-store" });
      const raw = await res.text();
      let data: unknown;
      try {
        data = raw.length > 0 ? JSON.parse(raw) : null;
      } catch (parseError) {
        console.error(
          `GET /api/settlements JSON parse failed (${res.status}):`,
          parseError,
          raw.slice(0, 200),
        );
        setSettlements([]);
        return;
      }
      if (!res.ok || !Array.isArray(data)) {
        console.error(`GET /api/settlements failed (${res.status}): expected JSON array`, {
          parsed: data,
          rawSnippet: raw.slice(0, 200),
        });
        setSettlements([]);
        return;
      }
      setSettlements(data as SettlementRecord[]);
    } catch (error) {
      console.error("Failed to load settlements", error);
      setSettlements([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial settlement fetch on mount
    void load();
  }, []);

  useEffect(() => {
    void fetch("/api/map/unhabitat-national-context")
      .then((r) => r.json())
      .then((j: UnHabitatNationalMapPayload) => setUnHabitatNational(j))
      .catch(() => setUnHabitatNational(null));
  }, []);

  async function saveGeometry(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
    const payload = {
      name: `New settlement ${new Date().toISOString().slice(0, 16)}`,
      geometry,
      source: "community member",
      verificationStatus: "draft",
      answers: {},
      atlasReference: false,
    };
    await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  async function deleteCommunitySettlement(settlement: SettlementRecord) {
    if (settlement.atlasReference === true) return;
    const ok = window.confirm(`Delete community settlement "${settlement.name}"? This cannot be undone.`);
    if (!ok) return;
    const res = await fetch(`/api/settlements/${settlement.id}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await res.text();
      window.alert(msg || "Failed to delete settlement.");
      return;
    }
    setSelected(null);
    await load();
  }

  const hasDemo = settlements.some((s) => s.createdBy === "seed-script" || (s.source ?? "").toLowerCase().includes("demo"));
  const atlasSettlements = useMemo(
    () => settlements.filter((s) => s.atlasReference === true),
    [settlements],
  );
  const communitySettlements = useMemo(
    () => settlements.filter((s) => s.atlasReference !== true),
    [settlements],
  );
  const visibleAtlasSettlements = useMemo(
    () => (showAtlas ? atlasSettlements : []),
    [atlasSettlements, showAtlas],
  );
  const visibleCommunitySettlements = useMemo(
    () => (showCommunity ? communitySettlements : []),
    [communitySettlements, showCommunity],
  );

  const layerRenderModel = useMemo(
    () => buildSettlementMapLayerModel(visibleAtlasSettlements, visibleCommunitySettlements),
    [visibleAtlasSettlements, visibleCommunitySettlements],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("showCommunity", showCommunity, "visibleCommunitySettlements", visibleCommunitySettlements.length);
  }, [showCommunity, visibleCommunitySettlements.length]);

  const atlasRefTrueCount = settlements.filter((s) => s.atlasReference === true).length;
  const atlasRefFalseCount = settlements.filter((s) => s.atlasReference !== true).length;
  let debugInvalidSkips = 0;
  if (SHOW_ATLAS_DEBUG && typeof window !== "undefined") {
    const raw = sessionStorage.getItem("atlasDebugInvalidSkips");
    if (raw != null && raw !== "") {
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n)) debugInvalidSkips = n;
    }
  }

  const atlasCoordExamples = settlements
    .filter((s) => s.atlasReference === true)
    .slice(0, 3)
    .map((s) => {
      try {
        const c = JSON.parse(s.centroid) as GeoJSON.Point;
        if (Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
          return `${s.name.slice(0, 40)}: [${c.coordinates[0].toFixed(4)}, ${c.coordinates[1].toFixed(4)}]`;
        }
      } catch {
        // ignore
      }
      return `${s.name.slice(0, 40)}: (unparsed)`;
    });

  const layerState: LayerState = {
    showAtlas,
    setShowAtlas,
    showCommunity,
    setShowCommunity,
    showUnHabitatContext,
    setShowUnHabitatContext,
  };

  return (
    <main className="settlement-map-host fixed inset-x-0 bottom-0 top-[6.2rem] overflow-hidden bg-zinc-950 text-zinc-100">
      <DynamicSettlementMap
        atlasSettlements={visibleAtlasSettlements}
        communitySettlements={visibleCommunitySettlements}
        onCreatePolygon={saveGeometry}
        onSelect={setSelected}
        showUnHabitat={showUnHabitatContext}
        unHabitatNational={unHabitatNational}
        zoomToSettlements={atlasSettlements}
        zoomToSettlementsTrigger={zoomAtlasTrigger}
        selectedId={selected?.id ?? null}
        className="h-full min-h-0 w-full"
      />

      {SHOW_ATLAS_DEBUG ? (
        <div
          className="pointer-events-none absolute bottom-24 right-4 z-[1000] max-w-xs rounded border border-amber-800/50 bg-zinc-950/90 px-2 py-1.5 font-mono text-[10px] text-amber-100/90"
          aria-hidden
        >
          <p className="text-[9px] uppercase tracking-wide text-zinc-500">Atlas debug (dev)</p>
          <p>total settlements: {settlements.length}</p>
          <p>map atlas props: {visibleAtlasSettlements.length}</p>
          <p>map community props: {visibleCommunitySettlements.length}</p>
          <p>rendered community polygons: {layerRenderModel.counts.communityPolygon}</p>
          <p>rendered community markers: {layerRenderModel.counts.communityMarker}</p>
          <p>rendered atlas polygons: {layerRenderModel.counts.atlasPolygon}</p>
          <p>rendered atlas markers: {layerRenderModel.counts.atlasMarker}</p>
          <p>atlasReference true: {atlasRefTrueCount}</p>
          <p>atlasReference false/undef: {atlasRefFalseCount}</p>
          <p>invalid coords skipped (import): {debugInvalidSkips}</p>
          {atlasCoordExamples.length ? (
            <p className="mt-0.5 break-words text-zinc-400">e.g. {atlasCoordExamples.join(" | ")}</p>
          ) : (
            <p className="mt-0.5 text-zinc-500">e.g. (no Atlas rows)</p>
          )}
        </div>
      ) : null}

      <div className="absolute left-5 top-[14.25rem] z-[1100] hidden max-h-[calc(100%-15.75rem)] w-[24rem] flex-col gap-4 overflow-y-auto md:flex">
        <section className="rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-5 shadow-xl shadow-black/40 backdrop-blur">
          <LayerCheckboxes {...layerState} />
          {isLoading ? <p className="mt-3 text-base text-zinc-300">Loading settlements...</p> : null}
          {hasDemo ? (
            <p className="mt-3 rounded-xl border border-amber-800/70 bg-amber-950/30 p-3 text-base leading-snug text-amber-200">
              Demo mode enabled: illustrative sample records are shown and are not verified.
            </p>
          ) : null}
        </section>
        <section className="rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-5 shadow-xl shadow-black/40 backdrop-blur">
          <LegendBlock />
        </section>
      </div>

      {/* Mobile: layers + legend in one expandable control (bottom-left, away from zoom stack) */}
      <details className="absolute bottom-3 left-3 z-[1100] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-zinc-700/80 bg-zinc-950/95 text-base shadow-lg backdrop-blur md:hidden">
        <summary className="cursor-pointer list-none px-3 py-3 text-base font-medium text-zinc-100 marker:content-none [&::-webkit-details-marker]:hidden">
          Map Layers
        </summary>
        <div className="max-h-[40vh] overflow-y-auto border-t border-zinc-700/80 px-3 pb-3 pt-2 text-sm">
          <LayerCheckboxes {...layerState} />
          <div className="mt-4 border-t border-zinc-700/80 pt-3">
            <LegendBlock />
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-zinc-700/80 pt-3">
            <Link href="/data-import" className={secondaryAction}>
              <Download className="h-5 w-5" aria-hidden />
              Import Data
            </Link>
            <Link href="/methodology" className={secondaryAction}>
              <BookOpen className="h-5 w-5" aria-hidden />
              Methodology
            </Link>
          </div>
        </div>
      </details>

      {/* Mobile: Add Settlement fixed under app nav, clear of Leaflet top-left */}
      <div className="fixed right-3 top-16 z-[1200] md:hidden">
        <Link href="/add-settlement" className={primaryAction}>
          <Plus className="h-5 w-5" aria-hidden />
          Add Settlement
        </Link>
      </div>

      {/* Desktop: secondary actions top-right */}
      <section className="absolute right-5 top-24 z-[1100] hidden flex-col gap-3 md:flex">
        <Link href="/add-settlement" className={primaryAction}>
          <Plus className="h-5 w-5" aria-hidden />
          Add Settlement
        </Link>
        <Link href="/data-import" className={secondaryAction}>
          <Download className="h-5 w-5" aria-hidden />
          Import Data
        </Link>
        <Link href="/methodology" className={secondaryAction}>
          <BookOpen className="h-5 w-5" aria-hidden />
          Methodology
        </Link>
        <button type="button" onClick={() => setZoomAtlasTrigger((v) => v + 1)} className={atlasAction}>
          <LocateFixed className="h-5 w-5" aria-hidden />
          Zoom to Atlas records
        </button>
      </section>

      {/* Side panel: on small screens, keep above bottom Map Layers; scroll when content is tall */}
      <aside
        className={`absolute z-[1150] overflow-y-auto rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-5 shadow-xl shadow-black/40 backdrop-blur md:bottom-6 md:right-5 md:left-auto md:max-h-[min(52vh,30rem)] md:w-full md:max-w-lg max-md:left-3 max-md:right-3 ${
          selected
            ? "max-md:top-28 max-md:bottom-auto max-md:max-h-[min(48vh,26rem)]"
            : "max-md:bottom-[4.75rem] max-md:top-auto max-md:max-h-28"
        }`}
      >
        {!selected ? (
          <div>
            <p className="text-lg font-semibold text-white">Settlement details</p>
            <p className="mt-2 text-lg leading-relaxed text-zinc-200">Select a polygon or bubble to open a settlement.</p>
          </div>
        ) : (
          <>
            {(() => {
              const isCommunity = selected.atlasReference !== true;
              const completeness = selected.calculatedScores?.[0]?.completenessScore;
              return (
                <>
            <h2 className="text-2xl font-semibold text-white">{selected.name}</h2>
            <p className="mt-1 text-lg text-zinc-200">{[selected.city, selected.country].filter(Boolean).join(", ")}</p>
            <div className="mt-4 space-y-1.5 text-lg leading-relaxed">
              <p>Population: {selected.population ?? "unknown"}</p>
              <p>
                Area:{" "}
                {(() => {
                  const area = settlementAreaM2(selected);
                  return area === null ? "Not available" : `${toAreaUnits(area).hectares.toFixed(2)} ha`;
                })()}
              </p>
              <p>
                <InfoTip label="Informality Score" info="0-1 scale where higher means greater deprivation/informality." />:{" "}
                {(() => {
                  const s = selected.calculatedScores?.[0]?.finalInformalityScore;
                  return typeof s === "number" && Number.isFinite(s) ? s.toFixed(2) : "Open profile for score";
                })()}
              </p>
              <p>
                <InfoTip label="Completeness" info="Share of score inputs available." />:{" "}
                {typeof completeness === "number" && Number.isFinite(completeness)
                  ? `${Math.round(completeness * 100)}%`
                  : "N/A"}
              </p>
              <p>Source: {selected.source ?? "N/A"}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {isCommunity ? (
                <>
                  <Link href={`/edit-settlement/${selected.id}`} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white md:text-base">
                    Edit Settlement
                  </Link>
                  <Link href={`/edit-settlement/${selected.id}`} className="rounded bg-indigo-500 px-3 py-2 text-sm text-black md:text-base">
                    Edit Geometry/Data
                  </Link>
                  <Link href={`/settlements/${selected.id}/summary`} className="rounded bg-violet-600 px-3 py-2 text-sm text-white md:text-base">
                    View Profile
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/settlements/${selected.id}`} className="rounded bg-zinc-700 px-3 py-2 text-sm md:text-base">
                    View profile
                  </Link>
                  <Link href={`/settlements/${selected.id}/summary`} className="rounded bg-violet-600 px-3 py-2 text-sm text-white md:text-base">
                    Complete profile
                  </Link>
                  <Link href={`/edit-settlement/${selected.id}`} className="rounded bg-indigo-500 px-3 py-2 text-sm text-black md:text-base">
                    Edit geometry/data
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-300 md:text-base"
              >
                Close panel
              </button>
              {isCommunity ? (
                <button
                  type="button"
                  onClick={() => void deleteCommunitySettlement(selected)}
                  className="rounded border border-rose-700 bg-rose-950/30 px-3 py-2 text-sm text-rose-200 md:text-base"
                >
                  Delete Community Settlement
                </button>
              ) : (
                <p className="w-full rounded border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm leading-snug text-zinc-400 md:text-base">
                  Atlas reference records cannot be deleted here. They can be hidden with the layer toggle.
                </p>
              )}
            </div>
                </>
              );
            })()}
          </>
        )}
      </aside>
    </main>
  );
}
