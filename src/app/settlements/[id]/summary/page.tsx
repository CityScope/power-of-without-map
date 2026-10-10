"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { toAreaUnits } from "@/lib/geo";

type ScoreRow = {
  finalInformalityScore: number | null;
  architectureScore: number | null;
  populaceScore: number | null;
  sitePillarScore?: number | null;
  completenessScore: number | null;
  uncertaintyScore: number | null;
  sourceReliabilityScore: number | null;
  confidenceScore: number | null;
  missingVariablesJson: string | null;
};

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

export default function SettlementSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [national, setNational] = useState<NationalCtx | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/settlements/${id}`).then((r) => r.json());
    setSettlement(data);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch settlement for summary
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

  const score = useMemo(() => ((settlement?.calculatedScores as ScoreRow[] | undefined) ?? [])[0], [settlement]);

  const missing = useMemo(() => {
    try {
      return JSON.parse(score?.missingVariablesJson ?? "[]") as string[];
    } catch {
      return [];
    }
  }, [score]);

  if (!settlement) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p className="text-zinc-400">Loading…</p>
      </main>
    );
  }

  const finalVal = score?.finalInformalityScore;
  const finalStr = finalVal === null || finalVal === undefined || Number.isNaN(Number(finalVal)) ? "—" : Number(finalVal).toFixed(2);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Settlement result</p>
          <h1 className="mt-1 text-3xl font-semibold">{String(settlement.name)}</h1>
          <p className="text-zinc-400">{[settlement.city, settlement.country].filter(Boolean).join(", ")}</p>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-lg">
          <p className="text-sm text-zinc-400">Informality Score (Architecture + Populace)</p>
          <p className="mt-2 text-5xl font-bold tracking-tight text-zinc-50">{finalStr}</p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            This score is indicative and depends on data completeness and source quality. Missing answers were not treated as zero; only
            available indicators were averaged with the documented weights.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-semibold text-zinc-100">Informality Profile</h2>
          <p className="mt-1 text-sm text-zinc-500">Three pillars: core index uses Architecture and Populace; Site is shown separately.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Site indicators describe context, risk, vulnerability, and community voice; they are shown as part of the Informality Profile but are not included in the current headline score.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-xs font-medium uppercase text-violet-400">Architecture</p>
              <p className="mt-2 text-2xl font-semibold">{score?.architectureScore === null || score?.architectureScore === undefined ? "—" : Number(score.architectureScore).toFixed(2)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Infrastructure, housing quality, crowding</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-xs font-medium uppercase text-emerald-400">Populace</p>
              <p className="mt-2 text-2xl font-semibold">{score?.populaceScore === null || score?.populaceScore === undefined ? "—" : Number(score.populaceScore).toFixed(2)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Economy, wellbeing, education &amp; equity</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-xs font-medium uppercase text-amber-400">Site</p>
              <p className="mt-2 text-2xl font-semibold">
                {score?.sitePillarScore === null || score?.sitePillarScore === undefined ? "—" : Number(score.sitePillarScore).toFixed(2)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">Hazards, spatial stress, voice</p>
            </div>
          </div>
        </section>

        {national?.matched && (national.proportion || national.total) ? (
          <section className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-6">
            <h2 className="text-lg font-semibold text-cyan-100">National context (UN-Habitat / HDX)</h2>
            <p className="mt-1 text-xs text-cyan-200/80">
              Country-level SDG 11.1.1 style indicators. Not settlement boundaries; shown when the settlement country name matches
              UN-Habitat country labels.
            </p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {national.proportion ? (
                <div className="rounded border border-cyan-900/50 bg-zinc-950/40 p-3">
                  <p className="text-xs uppercase text-cyan-400">Urban population in slums / informal settlements (share)</p>
                  <p className="mt-1 text-xl font-semibold text-cyan-50">
                    {national.proportion.indicatorValue}
                    {national.proportion.unit ? ` ${national.proportion.unit}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500">Reference year: {national.proportion.year}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Source: {national.proportion.source}</p>
                </div>
              ) : null}
              {national.total ? (
                <div className="rounded border border-cyan-900/50 bg-zinc-950/40 p-3">
                  <p className="text-xs uppercase text-cyan-400">Total population in slums and informal settlements</p>
                  <p className="mt-1 text-xl font-semibold text-cyan-50">
                    {national.total.indicatorValue}
                    {national.total.unit ? ` ${national.total.unit}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500">Reference year: {national.total.year}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Source: {national.total.source}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-300 sm:grid-cols-2">
          <div>
            <p>
              <InfoTip label="Completeness" info="Share of indicator slots filled across Architecture, Populace, and Site pillar inputs." />:{" "}
              {Math.round(Number(score?.completenessScore ?? 0) * 100)}%
            </p>
            <p className="mt-2">
              <InfoTip label="Uncertainty" info="Rises when data are sparse or OSM/source signals are weak." />:{" "}
              {Math.round(Number(score?.uncertaintyScore ?? 0) * 100)}%
            </p>
          </div>
          <div>
            <p>
              <InfoTip label="Source reliability" info="Heuristic from declared data source type." />:{" "}
              {Math.round(Number(score?.sourceReliabilityScore ?? 0) * 100)}%
            </p>
            <p className="mt-2">
              <InfoTip label="Open-data confidence" info="From OSM enrichment quality when available." />:{" "}
              {Math.round(Number(score?.confidenceScore ?? 0) * 100)}%
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-medium text-zinc-200">Missing data (sub-indicators)</p>
            <p className="mt-1 text-zinc-500">{missing.length ? missing.join(", ") : "None listed"}</p>
          </div>
          <div className="sm:col-span-2 text-xs text-zinc-600">
            Area: {toAreaUnits(Number(settlement.areaM2)).km2.toFixed(3)} km² · Population: {String(settlement.population ?? "unknown")}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/edit-settlement/${id}`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Improve this profile
          </Link>
          <Link href={`/settlements/${id}`} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
            Technical profile
          </Link>
          <Link href="/methodology" className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
            Methodology
          </Link>
          <Link href="/map" className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300">
            Back to Map
          </Link>
        </div>
      </div>
    </main>
  );
}
