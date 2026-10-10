"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { toAreaUnits } from "@/lib/geo";

type NationalCtx = {
  matched: boolean;
  proportion: {
    indicatorValue: string;
    unit: string;
    year: number;
    source: string;
    sourceUrl: string;
  } | null;
  total: {
    indicatorValue: string;
    unit: string;
    year: number;
    source: string;
    sourceUrl: string;
  } | null;
};

export default function SettlementProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [national, setNational] = useState<NationalCtx | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/settlements/${id}`).then((r) => r.json());
    setSettlement(data);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const country = settlement ? String(settlement.country ?? "") : "";
  useEffect(() => {
    if (!country.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear dependent UI when country is unset
      setNational(null);
      return;
    }
    const ac = new AbortController();
    void fetch(`/api/contextual-indicators/national?country=${encodeURIComponent(country)}`, { signal: ac.signal })
      .then((r) => r.json() as Promise<NationalCtx>)
      .then((data) => {
        if (!ac.signal.aborted) setNational(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setNational(null);
      });
    return () => ac.abort();
  }, [country]);

  const score = (settlement?.calculatedScores as Array<Record<string, unknown>> | undefined)?.[0];
  const scoreValue =
    score?.finalInformalityScore === null || score?.finalInformalityScore === undefined
      ? null
      : Number(score.finalInformalityScore);
  const latestEnrichment = useMemo(
    () => ((settlement?.enrichments as Array<Record<string, unknown>> | undefined) ?? []).at(-1),
    [settlement],
  );
  const suggestions = useMemo(
    () => JSON.parse((latestEnrichment?.suggestedValuesJson as string | undefined) ?? "{}") as Record<string, unknown>,
    [latestEnrichment],
  );
  const osmPayload = useMemo(
    () => JSON.parse((latestEnrichment?.osmJson as string | undefined) ?? "{}") as Record<string, unknown>,
    [latestEnrichment],
  );
  const suggestedMeta = useMemo(
    () =>
      (JSON.parse((latestEnrichment?.atlasJson as string | undefined) ?? "{}") as Record<
        string,
        { confidence: "high" | "medium" | "low"; explanation: string; basis: string }
      >) || {},
    [latestEnrichment],
  );
  const report = useMemo(
    () =>
      (JSON.parse((latestEnrichment?.beamJson as string | undefined) ?? "{}") as {
        roadsFound?: number;
        buildingsFound?: number;
        servicesFound?: number;
        gaps?: string[];
        enrichedAt?: string;
      }) || {},
    [latestEnrichment],
  );
  const currentAnswers = useMemo(
    () =>
      JSON.parse(
        (((settlement?.surveyResponses as Array<Record<string, unknown>> | undefined) ?? [])[0]?.rawAnswersJson as
          | string
          | undefined) ?? "{}",
      ) as Record<string, unknown>,
    [settlement],
  );

  if (!settlement) return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">Loading settlement profile...</main>;
  const isDemo = String(settlement.createdBy ?? "") === "seed-script" || String(settlement.source ?? "").toLowerCase().includes("demo");
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-3xl font-semibold">{String(settlement.name)}</h1>
      {isDemo && (
        <div className="mt-2 inline-block rounded border border-amber-800/70 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200" aria-label="Illustrative demo data">
          Illustrative demo data (not verified)
        </div>
      )}
      <p className="text-zinc-400">{[settlement.city, settlement.country].filter(Boolean).join(", ")}</p>
      <div className="mt-6 grid gap-3 rounded border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <p>Area: {toAreaUnits(Number(settlement.areaM2)).km2.toFixed(3)} km2</p>
        <p>Population: {String(settlement.population ?? "unknown")}</p>
        <p>
          <InfoTip label="Informality Score" info="0-1 scale where higher means more informal/deprived." />:{" "}
          {scoreValue === null || Number.isNaN(scoreValue) ? "N/A" : scoreValue.toFixed(2)}
        </p>
        <p>
          <InfoTip label="Percentile rank" info="Relative position among all recorded settlements globally." />:{" "}
          {score?.globalPercentileRank !== null && score?.globalPercentileRank !== undefined
            ? `${Math.round(Number(score.globalPercentileRank) * 100)}% (more informal than this share of recorded settlements)`
            : "N/A"}
        </p>
        <p>
          <InfoTip label="Completeness" info="Share of score inputs available (missing data excluded, not zeroed)." />:{" "}
          {Math.round(Number(score?.completenessScore ?? 0) * 100)}%
        </p>
        <p>
          <InfoTip label="Confidence (OSM quality)" info="Confidence derived from open-data feature quality and coverage signals." />:{" "}
          {Math.round(Number(score?.confidenceScore ?? 0) * 100)}%
        </p>
        <p>
          <InfoTip label="Source reliability" info="Reliability weighting by source type (community/NGO/government/open-data)." />:{" "}
          {Math.round(Number(score?.sourceReliabilityScore ?? 0) * 100)}%
        </p>
        <p>
          <InfoTip label="Uncertainty score" info="Combined uncertainty from completeness, OSM confidence, and source reliability." />:{" "}
          {Math.round(Number(score?.uncertaintyScore ?? 0) * 100)}%
        </p>
        <p>Missing Variables: {String(score?.missingVariablesJson ?? "[]")}</p>
        <p>Formula version: {String(score?.formulaVersion ?? "N/A")}</p>
        <p>Normalization version: {String(score?.normalizationVersion ?? "N/A")}</p>
        <p>Calculation version: {String(score?.calculationVersion ?? "N/A")}</p>
        <p>Source: {String(settlement.source ?? "n/a")}</p>
      </div>

      {national?.matched && (national.proportion || national.total) ? (
        <div className="mt-4 rounded border border-cyan-900/50 bg-cyan-950/20 p-4 text-sm text-zinc-200">
          <h3 className="font-semibold text-cyan-100">National context (UN-Habitat / HDX)</h3>
          <p className="mt-1 text-xs text-cyan-200/80">Country-level indicators. Not settlement boundaries.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {national.proportion ? (
              <p>
                <span className="text-zinc-500">Proportion in slums/informal settlements: </span>
                {national.proportion.indicatorValue}
                {national.proportion.unit ? ` ${national.proportion.unit}` : ""} ({national.proportion.year})
              </p>
            ) : null}
            {national.total ? (
              <p>
                <span className="text-zinc-500">Total population in slums/informal settlements: </span>
                {national.total.indicatorValue}
                {national.total.unit ? ` ${national.total.unit}` : ""} ({national.total.year})
              </p>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Source: {national.proportion?.source ?? national.total?.source ?? "UN-Habitat / HDX"}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/settlements/${id}/summary`} className="rounded bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-500">
          Score summary
        </Link>
        <button
          aria-label="Enrich with Open Data"
          onClick={async () => {
            await fetch(`/api/settlements/${id}/enrich`, { method: "POST" });
            await load();
          }}
          className="rounded bg-emerald-500 px-3 py-1 text-sm text-black"
        >
          Enrich with Open Data
        </button>
      </div>

      {Object.keys(suggestions).length > 0 && (
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-2 text-sm font-semibold">Suggested KPI values (OSM/open data)</h3>
          <div className="mb-3 rounded bg-zinc-950 p-2 text-xs">
            {Object.keys(suggestions).map((key) => (
              <p key={`src-${key}`}>
                {key}:{" "}
                {currentAnswers[key] !== undefined && currentAnswers[key] !== null
                  ? "User provided"
                  : suggestions[key] !== undefined && suggestions[key] !== null
                    ? "Open data suggested"
                    : "Missing"}
                {" | "}user={String(currentAnswers[key] ?? "blank")} | open-data={String(suggestions[key] ?? "blank")}
              </p>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {Object.entries(suggestions).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between gap-4">
                <span>
                  {key}: {String(value)}{" "}
                  <span className="text-zinc-400">
                    (source: OSM, confidence: {suggestedMeta[key]?.confidence ?? "low"}, basis: {suggestedMeta[key]?.basis ?? "mixed"})
                  </span>
                  <br />
                  <span className="text-xs text-zinc-500">{suggestedMeta[key]?.explanation ?? "Derived from polygon-filtered OSM."}</span>
                </span>
                <input
                  aria-label={`Accept suggested value for ${key}`}
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={(e) => {
                    setSelected((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)));
                  }}
                />
              </label>
            ))}
          </div>
          <button
            aria-label="Accept Suggestions"
            onClick={async () => {
              const rejected = Object.keys(suggestions).filter((k) => !selected.includes(k));
              await fetch(`/api/settlements/${id}/apply-suggestions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ acceptedKeys: selected, rejectedKeys: rejected }),
              });
              setSelected([]);
              await load();
            }}
            className="mt-3 rounded bg-indigo-500 px-3 py-1 text-sm text-black"
          >
            Accept Suggestions
          </button>
        </div>
      )}
      {Object.keys(suggestions).length === 0 ? (
        <div className="mt-4 rounded border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
          No open-data suggestions yet. Use <span className="text-zinc-200">Enrich with Open Data</span> to generate suggestions.
        </div>
      ) : null}
      <div className="mt-4 rounded border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <h3 className="font-semibold">Enrichment Report</h3>
        <p>OSM roads found: {Number(report.roadsFound ?? (osmPayload.counts as Record<string, { inside: number }>)?.roads?.inside ?? 0)}</p>
        <p>Buildings found: {Number(report.buildingsFound ?? (osmPayload.counts as Record<string, { inside: number }>)?.buildings?.inside ?? 0)}</p>
        <p>Services found: {Number(report.servicesFound ?? 0)}</p>
        <p>Missing/open-data gaps: {(report.gaps ?? []).length ? (report.gaps ?? []).join("; ") : "None"}</p>
        <p>Enriched at: {String(report.enrichedAt ?? latestEnrichment?.lastCheckedAt ?? "N/A")}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/edit-settlement/${id}`} className="rounded bg-indigo-500 px-3 py-1 text-sm text-black">Edit Settlement</Link>
        <Link href="/methodology" className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-200">Methodology</Link>
        <Link href="/map" className="rounded bg-zinc-700 px-3 py-1 text-sm">Back to Map</Link>
        {settlement.atlasReference === true ? (
          <p className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-400">
            Atlas reference records cannot be deleted here. They can be hidden with the layer toggle.
          </p>
        ) : (
          <button
            type="button"
            className="rounded border border-rose-700 bg-rose-950/30 px-3 py-1 text-sm text-rose-200"
            onClick={async () => {
              const ok = window.confirm(`Delete community settlement "${String(settlement.name)}"? This cannot be undone.`);
              if (!ok) return;
              const res = await fetch(`/api/settlements/${id}`, { method: "DELETE" });
              if (!res.ok) {
                window.alert(await res.text());
                return;
              }
              router.push("/map");
              router.refresh();
            }}
          >
            Delete Community Settlement
          </button>
        )}
      </div>
    </main>
  );
}
