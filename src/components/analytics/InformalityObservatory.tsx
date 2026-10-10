"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartCard, EmptyState, ScoreScatter, VerticalBars } from "@/components/analytics/observatoryCharts";
import {
  applyFilters,
  completenessHistogram,
  countryLabel,
  DEFAULT_FILTERS,
  dimensionCoverage,
  findNationalContext,
  finiteScore,
  missingIndicatorFrequency,
  overviewOf,
  scoreHistogram,
  settlementsByCountry,
  summarize,
  UNKNOWN_COUNTRY,
  valuesOf,
  type NationalContextIndicator,
  type ObservatoryFilters,
  type SettlementObservation,
} from "@/lib/analyticsObservatory";

type Payload = {
  settlements: SettlementObservation[];
  nationalIndicators: NationalContextIndicator[];
};

const NAV = [
  ["overview", "Overview"],
  ["informality", "Informality"],
  ["dimensions", "Dimensions"],
  ["quality", "Data quality"],
  ["geography", "Geography"],
  ["compare", "Compare"],
] as const;

const selectClass =
  "h-12 w-full rounded-xl border border-zinc-600 bg-zinc-950 px-3 text-base text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

function formatScore(value: number | null | undefined) {
  const score = finiteScore(value);
  return score === null ? "Not available" : score.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  const score = finiteScore(value);
  return score === null ? "Not available" : `${Math.round(score * 100)}%`;
}

function scoreClass(value: number | null | undefined) {
  return finiteScore(value) === null ? "text-zinc-400" : "text-amber-300";
}

export function InformalityObservatory() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ObservatoryFilters>(DEFAULT_FILTERS);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
        return (await response.json()) as Payload;
      })
      .then((json) => {
        setPayload(json);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The observatory could not load the current dataset.");
      });
    return () => controller.abort();
  }, []);

  const settlements = useMemo(() => payload?.settlements ?? [], [payload]);
  const nationals = useMemo(() => payload?.nationalIndicators ?? [], [payload]);
  const filtered = useMemo(() => applyFilters(settlements, filters), [settlements, filters]);
  const overview = useMemo(() => overviewOf(filtered), [filtered]);
  const scoreValues = useMemo(() => valuesOf(filtered, (row) => row.finalScore), [filtered]);
  const scoreSummary = useMemo(() => summarize(scoreValues), [scoreValues]);
  const communityCompleteness = useMemo(
    () => summarize(valuesOf(filtered.filter((row) => !row.atlasReference), (row) => row.completeness)),
    [filtered],
  );
  const countries = useMemo(() => settlementsByCountry(filtered), [filtered]);
  const missing = useMemo(() => missingIndicatorFrequency(filtered), [filtered]);
  const uncertaintyValues = useMemo(() => valuesOf(filtered, (row) => row.uncertainty), [filtered]);

  const countryOptions = useMemo(() => {
    const names = new Set(settlements.map((row) => countryLabel(row.country)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [settlements]);
  const statusOptions = useMemo(() => {
    const names = new Set(settlements.map((row) => row.verificationStatus));
    return Array.from(names).sort();
  }, [settlements]);

  const left = filtered.find((row) => row.id === leftId) ?? null;
  const right = filtered.find((row) => row.id === rightId) ?? null;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8">
        <h1 className="text-[2.25rem] font-semibold text-white">Informal Settlements Observatory</h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">{error}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:px-8">
        <h1 className="text-[2.25rem] font-semibold text-white">Informal Settlements Observatory</h1>
        <p className="mt-4 text-lg text-zinc-300">Loading the observatory…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1680px]">
        <header className="max-w-4xl">
          <p className="text-base font-medium uppercase tracking-[0.14em] text-amber-200">Analytics</p>
          <h1 className="mt-2 text-[2.25rem] font-semibold leading-tight tracking-tight text-white md:text-[2.625rem]">Informal Settlements Observatory</h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-200">Explore the geography, conditions, and available evidence on informal settlements around the world.</p>
        </header>

        <nav aria-label="Observatory sections" className="sticky top-[6.2rem] z-20 -mx-4 mt-6 border-y border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:-mx-10 lg:px-10">
          <ul className="flex gap-2 overflow-x-auto">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-zinc-700 px-4 text-base text-zinc-100 hover:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <FilterBar
          filters={filters}
          countries={countryOptions}
          statuses={statusOptions}
          shown={filtered.length}
          total={settlements.length}
          active={filtersActive}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />

        <div className="mt-10 space-y-16">
          <section id="overview" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro
              title="What data do we have?"
              text="The atlas combines reference settlement locations with community-contributed profiles. Not all settlements have enough information to calculate an informality score."
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Total settlements" value={String(overview.total)} note="Records in the current view." />
              <Metric label="Atlas references" value={String(overview.atlas)} note="Imported reference locations." />
              <Metric label="Community contributions" value={String(overview.community)} note="Records collected through the questionnaire." />
              <Metric label="Settlements with scores" value={String(overview.scored)} note="Valid Informality Scores. Missing scores are excluded, not counted as zero." />
              <Metric label="Countries represented" value={String(overview.countries)} note="Countries with a recorded name. Unknown locations are not assigned a country." />
              <Metric
                label="Data completeness"
                value={communityCompleteness ? formatPercent(communityCompleteness.mean) : "Not available"}
                note={
                  communityCompleteness
                    ? `Mean questionnaire completeness across ${communityCompleteness.n} community contributions with a stored completeness value. This is not wizard progress, and atlas references are excluded.`
                    : "No community contribution in this view has a stored completeness value."
                }
              />
            </div>
            {overview.statusCounts.length > 0 ? (
              <p className="text-[1.0625rem] text-zinc-300">
                Record status in this view: {overview.statusCounts.map(([status, count]) => `${status} ${count}`).join(" · ")}.
              </p>
            ) : null}
          </section>

          <section id="informality" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro title="Understanding informality" text="How do measured levels of informality vary across settlements with available data?" />
            <ChartCard
              title="Informality Score distribution"
              explanation="Higher scores indicate greater informality and deprivation, on a scale from 0 to 1. These settlements are the ones with a stored score. They are not a census of all informal settlements."
              sample={scoreSummary ? `Based on ${scoreSummary.n} settlements with available scores.` : undefined}
            >
              {scoreSummary ? (
                <VerticalBars data={scoreHistogram(scoreValues)} color="#fbbf24" valueLabel="Settlements" />
              ) : (
                <EmptyState>No settlement in this view has an Informality Score. Missing scores are left blank rather than drawn as zero.</EmptyState>
              )}
            </ChartCard>
            {scoreSummary ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Median" value={scoreSummary.median.toFixed(2)} note={`Across ${scoreSummary.n} scored settlements.`} emphasize />
                <Metric label="Average" value={scoreSummary.mean.toFixed(2)} note="Arithmetic mean of valid scores only." emphasize />
                <Metric label="Minimum" value={scoreSummary.min.toFixed(2)} note="A stored zero remains zero." emphasize />
                <Metric label="Maximum" value={scoreSummary.max.toFixed(2)} note="Highest valid score in this view." emphasize />
              </div>
            ) : null}
          </section>

          <section id="dimensions" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro title="What shapes informality?" text="Explore the dimensions behind the overall informality profile. A dimension score appears only when that dimension has stored inputs." />
            <div className="grid gap-4 lg:grid-cols-3">
              <DimensionPanel
                title="Architecture"
                note="Part of the headline score, with Infrastructure, Physical nature, and Compactness."
                rows={filtered}
                score={(row) => row.architecture}
                parts={[
                  ["Infrastructure", (row) => row.infrastructure],
                  ["Physical nature", (row) => row.physicalNature],
                  ["Compactness", (row) => row.compactness],
                ]}
              />
              <DimensionPanel
                title="Populace"
                note="Part of the headline score, with Economy, Quality of life, and Demography."
                rows={filtered}
                score={(row) => row.populace}
                parts={[
                  ["Economy", (row) => row.economy],
                  ["Quality of life", (row) => row.qualityOfLife],
                  ["Demography", (row) => row.demography],
                ]}
              />
              <DimensionPanel
                title="Site"
                note="Contextual profile. Site is not included in the headline Informality Score."
                rows={filtered}
                score={(row) => row.site}
                parts={[]}
                contextual
              />
            </div>
            <ArchitecturePopulaceComparison rows={filtered} />
          </section>

          <section id="quality" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro title="How complete is our knowledge?" text="Understanding what we do not know is as important as understanding the data we have." />
            <ChartCard
              title="Questionnaire completeness"
              explanation="Completeness is the share of score indicators with answers. It is not the same as finishing the wizard, and it does not describe the condition of the settlement. A known 0% means the stored calculation found no completed indicators."
              sample={communityCompleteness ? `Based on ${communityCompleteness.n} community contributions with a stored completeness value.` : undefined}
            >
              {communityCompleteness ? (
                <VerticalBars
                  data={completenessHistogram(valuesOf(filtered.filter((row) => !row.atlasReference), (row) => row.completeness))}
                  color="#8b5cf6"
                  valueLabel="Community contributions"
                />
              ) : (
                <EmptyState>No community contribution in this view has a stored completeness value.</EmptyState>
              )}
            </ChartCard>
            <ChartCard
              title="Most frequently missing indicators"
              explanation="Counts come from community contributions that stored a missing-indicator list. Atlas references are excluded, because those records were not collected with this questionnaire."
              sample={`Denominator: ${missing.denominator} community contributions with a stored missing-indicator list.`}
            >
              {missing.items.length === 0 ? (
                <EmptyState>No missing-indicator list is available for the community contributions in this view.</EmptyState>
              ) : (
                <IndicatorBars items={missing.items.slice(0, 12)} />
              )}
            </ChartCard>
            <ChartCard
              title="Where dimension scores exist"
              explanation="A stored dimension score means at least one of its indicators was present. It does not mean that dimension is complete. Missing scores are not drawn as zero."
              sample={`Across ${filtered.length} settlements in this view.`}
            >
              <div className="space-y-4">
                {(
                  [
                    ["Informality Score", (row: SettlementObservation) => row.finalScore],
                    ["Architecture", (row: SettlementObservation) => row.architecture],
                    ["Populace", (row: SettlementObservation) => row.populace],
                    ["Site profile", (row: SettlementObservation) => row.site],
                    ["Infrastructure", (row: SettlementObservation) => row.infrastructure],
                    ["Physical nature", (row: SettlementObservation) => row.physicalNature],
                    ["Compactness", (row: SettlementObservation) => row.compactness],
                    ["Economy", (row: SettlementObservation) => row.economy],
                    ["Quality of life", (row: SettlementObservation) => row.qualityOfLife],
                    ["Demography", (row: SettlementObservation) => row.demography],
                  ] as const
                ).map(([label, pick]) => {
                  const coverage = dimensionCoverage(filtered, pick);
                  const width = coverage.total ? (coverage.available / coverage.total) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-lg text-white">{label}</p>
                        <p className="text-base text-zinc-300">
                          {coverage.available} with a score · {coverage.missing} without
                        </p>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
                        <div className="h-full rounded-full bg-amber-300" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
            <ChartCard
              title="Stored uncertainty"
              explanation="When a score is saved, uncertainty combines questionnaire completeness, open-data confidence, and source reliability. It is not a statistical confidence interval, and it is omitted when no value was stored."
              sample={uncertaintyValues.length ? `Based on ${uncertaintyValues.length} settlements with a stored uncertainty value.` : undefined}
            >
              {uncertaintyValues.length ? (
                <VerticalBars data={scoreHistogram(uncertaintyValues)} color="#a1a1aa" valueLabel="Settlements" />
              ) : (
                <EmptyState>No stored uncertainty values are available in this view.</EmptyState>
              )}
            </ChartCard>
          </section>

          <section id="geography" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro
              title="Settlements in their geographic context"
              text="Explore where settlements are documented and place local evidence alongside national indicators. Settlement records store a country, not a region. UN-Habitat region is shown only on the national indicator."
            />
            <ChartCard
              title="Settlements by country"
              explanation="Each bar splits atlas references and community contributions. The scored count uses only valid Informality Scores. Unknown is kept as its own category."
              sample={`${countries.length} countries or unknown-location groups in this view. Selecting a country filters the observatory.`}
            >
              {countries.length === 0 ? (
                <EmptyState>No settlements match the current filters.</EmptyState>
              ) : (
                <CountryBars
                  rows={countries}
                  active={filters.country}
                  onSelect={(country) => setFilters((current) => ({ ...current, country: current.country === country ? "all" : country }))}
                />
              )}
            </ChartCard>
            <ChartCard
              title="National UN-Habitat context"
              explanation="National indicators describe country-level conditions. Settlement scores describe individual community profiles. They should not be interpreted as equivalent measurements."
            >
              <NationalContext rows={filtered} nationals={nationals} countries={countries} />
            </ChartCard>
            <p className="text-[1.0625rem] leading-relaxed text-zinc-300">
              <Link href="/map" className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4">
                Open the atlas map
              </Link>
              . The map shows the full atlas. It does not yet accept a country filter from this page.
            </p>
          </section>

          <section id="compare" className="scroll-mt-[10.5rem] space-y-6">
            <SectionIntro title="Explore and compare settlements" text="Move from global patterns to individual community profiles. Comparison uses stored scores only." />
            <div className="grid gap-4 md:grid-cols-2">
              <SettlementPicker label="Settlement A" rows={filtered} selectedId={left?.id ?? null} excludeId={right?.id ?? null} onSelect={setLeftId} />
              <SettlementPicker label="Settlement B" rows={filtered} selectedId={right?.id ?? null} excludeId={left?.id ?? null} onSelect={setRightId} />
            </div>
            <ComparisonTable left={left} right={right} nationals={nationals} />
          </section>

          <section id="about" className="scroll-mt-[10.5rem] rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 md:p-8">
            <h2 className="text-[1.65rem] font-semibold text-white md:text-[1.85rem]">About these results</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[1.0625rem] leading-relaxed text-zinc-300">
              <li>The atlas includes reference locations and community-contributed profiles. They are not equivalent data sources.</li>
              <li>Community questionnaire coverage is incomplete. A missing score is not zero, and a known completeness of 0% is reported as 0%.</li>
              <li>The settlements in this view are not a representative sample of all informal settlements.</li>
              <li>National UN-Habitat figures and local informality scores measure different things. Indicator years and source coverage can differ.</li>
              <li>Results should be read in their geographic and methodological context.</li>
            </ul>
            <p className="mt-4 text-[1.0625rem]">
              <Link href="/methodology" className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4">
                Read the methodology
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-[1.75rem] font-semibold leading-tight text-white md:text-[1.85rem]">{title}</h2>
      <p className="mt-2 text-lg leading-relaxed text-zinc-200">{text}</p>
    </div>
  );
}

function Metric({ label, value, note, emphasize = false }: { label: string; value: string; note: string; emphasize?: boolean }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <p className={`mt-3 text-4xl font-semibold tabular-nums leading-none md:text-5xl ${emphasize && value !== "Not available" ? "text-amber-300" : "text-white"}`}>{value}</p>
      <p className="mt-3 text-base leading-relaxed text-zinc-400">{note}</p>
    </article>
  );
}

function FilterBar({
  filters,
  countries,
  statuses,
  shown,
  total,
  active,
  onChange,
  onReset,
}: {
  filters: ObservatoryFilters;
  countries: string[];
  statuses: string[];
  shown: number;
  total: number;
  active: boolean;
  onChange: (next: ObservatoryFilters) => void;
  onReset: () => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-lg text-white">
          Showing <span className="font-semibold text-amber-200">{shown.toLocaleString()}</span> of {total.toLocaleString()} settlements
        </p>
        {active ? (
          <button type="button" className="min-h-11 rounded-xl border border-zinc-600 px-4 text-base text-zinc-100" onClick={onReset}>
            Reset filters
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterLabel label="Record type">
          <select className={selectClass} value={filters.recordType} onChange={(event) => onChange({ ...filters, recordType: event.target.value as ObservatoryFilters["recordType"] })}>
            <option value="all">All records</option>
            <option value="atlas">Atlas references</option>
            <option value="community">Community contributions</option>
          </select>
        </FilterLabel>
        <FilterLabel label="Status">
          <select className={selectClass} value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterLabel>
        <FilterLabel label="Country">
          <select className={selectClass} value={filters.country} onChange={(event) => onChange({ ...filters, country: event.target.value })}>
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country === UNKNOWN_COUNTRY ? "Unknown location" : country}
              </option>
            ))}
          </select>
        </FilterLabel>
        <FilterLabel label="Score">
          <select
            className={selectClass}
            value={filters.scoreAvailability}
            onChange={(event) => onChange({ ...filters, scoreAvailability: event.target.value as ObservatoryFilters["scoreAvailability"] })}
          >
            <option value="all">All records</option>
            <option value="scored">With an Informality Score</option>
            <option value="unscored">Without an Informality Score</option>
          </select>
        </FilterLabel>
        <FilterLabel label="Completeness">
          <select className={selectClass} value={filters.completeness} onChange={(event) => onChange({ ...filters, completeness: event.target.value as ObservatoryFilters["completeness"] })}>
            <option value="all">Any completeness</option>
            <option value="0-25">0–25%</option>
            <option value="25-50">25–50%</option>
            <option value="50-75">50–75%</option>
            <option value="75-100">75–100%</option>
            <option value="unknown">Completeness not stored</option>
          </select>
        </FilterLabel>
      </div>
    </section>
  );
}

function FilterLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-base text-zinc-300">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DimensionPanel({
  title,
  note,
  rows,
  score,
  parts,
  contextual = false,
}: {
  title: string;
  note: string;
  rows: SettlementObservation[];
  score: (row: SettlementObservation) => number | null;
  parts: Array<[string, (row: SettlementObservation) => number | null]>;
  contextual?: boolean;
}) {
  const summary = summarize(valuesOf(rows, score));
  return (
    <article className={`rounded-2xl border p-5 ${contextual ? "border-dashed border-violet-400/40 bg-violet-950/20" : "border-zinc-800 bg-zinc-900/70"}`}>
      <h3 className="text-[1.35rem] font-semibold text-white md:text-2xl">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-zinc-300">{note}</p>
      <p className={`mt-4 text-4xl font-semibold tabular-nums ${scoreClass(summary?.mean ?? null)}`}>{summary ? summary.mean.toFixed(2) : "Not available"}</p>
      <p className="mt-2 text-base text-zinc-400">{summary ? `Average of ${summary.n} settlements with this score.` : "No stored score in this view."}</p>
      {parts.length > 0 ? (
        <details className="mt-4 border-t border-zinc-800 pt-3">
          <summary className="cursor-pointer text-base font-medium text-zinc-100">View subdimensions</summary>
          <ul className="mt-3 space-y-3">
            {parts.map(([label, pick]) => {
              const part = summarize(valuesOf(rows, pick));
              return (
                <li key={label}>
                  <p className="text-base text-zinc-300">{label}</p>
                  <p className={`text-2xl font-semibold tabular-nums ${scoreClass(part?.mean ?? null)}`}>{part ? part.mean.toFixed(2) : "Not available"}</p>
                  <p className="text-[0.9375rem] text-zinc-400">{part ? `${part.n} settlements` : "No stored score"}</p>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
      {summary ? (
        <div className="mt-4">
          <VerticalBars data={scoreHistogram(valuesOf(rows, score))} color={contextual ? "#c4b5fd" : "#fbbf24"} valueLabel="Settlements" />
        </div>
      ) : null}
    </article>
  );
}

function ArchitecturePopulaceComparison({ rows }: { rows: SettlementObservation[] }) {
  const paired = rows.flatMap((row) => {
    const architecture = finiteScore(row.architecture);
    const populace = finiteScore(row.populace);
    if (architecture === null || populace === null) return [];
    return [{ architecture, populace, name: row.name }];
  });
  return (
    <ChartCard
      title="Architecture and Populace"
      explanation="Each point is one settlement with both an Architecture score and a Populace score. Settlements missing either score are left out. The two dimensions are averaged, with equal weight, into the headline score when both exist."
      sample={`Based on ${paired.length} settlements with both dimension scores.`}
    >
      {paired.length === 0 ? <EmptyState>No settlement in this view has both an Architecture score and a Populace score.</EmptyState> : <ScoreScatter data={paired} />}
    </ChartCard>
  );
}

function IndicatorBars({ items }: { items: Array<{ key: string; label: string; count: number; percent: number }> }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base leading-snug text-white" title={item.key}>
              {item.label}
            </p>
            <p className="text-base tabular-nums text-zinc-300">
              {item.count} · {item.percent.toFixed(0)}%
            </p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <p className="mt-1 text-[0.9375rem] text-zinc-500">Identifier: {item.key}</p>
        </li>
      ))}
    </ul>
  );
}

function CountryBars({
  rows,
  active,
  onSelect,
}: {
  rows: Array<{ country: string; total: number; atlas: number; community: number; scored: number }>;
  active: string;
  onSelect: (country: string) => void;
}) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  return (
    <ul className="max-h-[32rem] space-y-2 overflow-auto pr-1">
      {rows.map((row) => {
        const name = row.country === UNKNOWN_COUNTRY ? "Unknown location" : row.country;
        const selected = active === row.country;
        return (
          <li key={row.country}>
            <button
              type="button"
              onClick={() => onSelect(row.country)}
              className={`w-full rounded-xl border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${selected ? "border-amber-300 bg-amber-400/10" : "border-zinc-800 hover:border-zinc-600"}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg text-white">{name}</span>
                <span className="text-base text-zinc-300">
                  {row.total} records · {row.scored} with scores
                </span>
              </span>
              <span className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
                <span className="h-full bg-amber-300" style={{ width: `${(row.atlas / max) * 100}%` }} />
                <span className="h-full bg-zinc-400" style={{ width: `${(row.community / max) * 100}%` }} />
              </span>
              <span className="mt-2 block text-[0.9375rem] text-zinc-400">
                Atlas {row.atlas} · Community {row.community}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NationalContext({
  rows,
  nationals,
  countries,
}: {
  rows: SettlementObservation[];
  nationals: NationalContextIndicator[];
  countries: Array<{ country: string; total: number; scored: number }>;
}) {
  const matched = countries.flatMap((country) => {
    if (country.country === UNKNOWN_COUNTRY) return [];
    const national = findNationalContext(country.country, nationals);
    if (!national) return [];
    return [{ ...country, national }];
  });
  return (
    <div className="space-y-4">
      {matched.length === 0 ? (
        <EmptyState>No country in this view matches a stored UN-Habitat country name. National values are not estimated.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-base">
            <thead className="text-[0.9375rem] uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="py-2 pr-3 font-medium">Country</th>
                <th className="py-2 pr-3 font-medium">Settlements</th>
                <th className="py-2 pr-3 font-medium">With scores</th>
                <th className="py-2 pr-3 font-medium">Slum share</th>
                <th className="py-2 pr-3 font-medium">Slum population</th>
                <th className="py-2 font-medium">UN-Habitat region</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((row) => (
                <tr key={row.country} className="border-t border-zinc-800 text-zinc-100">
                  <td className="py-3 pr-3">{row.country}</td>
                  <td className="py-3 pr-3 tabular-nums">{row.total}</td>
                  <td className="py-3 pr-3 tabular-nums">{row.scored}</td>
                  <td className="py-3 pr-3">
                    {row.national.proportion ? `${row.national.proportion.value.toFixed(1)}% · ${row.national.proportion.year}` : "Not available"}
                  </td>
                  <td className="py-3 pr-3">
                    {row.national.population ? `${row.national.population.value.toLocaleString()} · ${row.national.population.year}` : "Not available"}
                  </td>
                  <td className="py-3">
                    {[row.national.region, row.national.subRegion].filter(Boolean).join(" · ") || "Not available"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.9375rem] text-zinc-400">
        Source: {nationals[0]?.source ?? "UN-Habitat / HDX"}. Years belong to each national indicator. {rows.length} settlement records are in this view.
      </p>
      <details className="rounded-xl border border-zinc-800 px-4 py-3">
        <summary className="cursor-pointer text-base font-medium text-zinc-100">Browse all stored national indicators ({nationals.length})</summary>
        <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-base text-zinc-300">
          {nationals.length === 0 ? <li>No national indicators have been imported.</li> : null}
          {nationals.map((item) => (
            <li key={item.countryCode || item.country}>
              {item.country}
              {item.proportion ? ` · ${item.proportion.value.toFixed(1)}% (${item.proportion.year})` : " · share not available"}
              {item.population ? ` · population ${item.population.value.toLocaleString()} (${item.population.year})` : " · population not available"}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SettlementPicker({
  label,
  rows,
  selectedId,
  excludeId,
  onSelect,
}: {
  label: string;
  rows: SettlementObservation[];
  selectedId: string | null;
  excludeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 1) return [];
    return rows
      .filter((row) => row.id !== excludeId)
      .filter((row) => `${row.name} ${row.country ?? ""} ${row.city ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [excludeId, query, rows]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-base font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, city, or country"
        className={`${selectClass} mt-3`}
        aria-label={`${label} search`}
      />
      {matches.length > 0 ? (
        <ul className="mt-2 overflow-hidden rounded-xl border border-zinc-800">
          {matches.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-base text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  onSelect(row.id);
                  setQuery("");
                }}
              >
                {row.name}
                <span className="mt-0.5 block text-[0.9375rem] text-zinc-400">{countryLabel(row.country)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-lg text-white">{selected ? selected.name : "None selected"}</p>
      {selected ? (
        <button type="button" className="mt-2 text-base text-zinc-400 underline" onClick={() => onSelect(null)}>
          Clear
        </button>
      ) : (
        <p className="mt-2 text-[0.9375rem] text-zinc-500">Type at least one letter. The search uses the filtered dataset.</p>
      )}
    </div>
  );
}

function ComparisonTable({
  left,
  right,
  nationals,
}: {
  left: SettlementObservation | null;
  right: SettlementObservation | null;
  nationals: NationalContextIndicator[];
}) {
  if (!left && !right) return <EmptyState>Choose two settlements to compare their stored profiles.</EmptyState>;
  const rows: Array<[string, (row: SettlementObservation) => string, boolean]> = [
    ["Country", (row) => countryLabel(row.country), false],
    ["Record type", (row) => (row.atlasReference ? "Atlas reference" : "Community contribution"), false],
    ["Status", (row) => row.verificationStatus, false],
    ["Informality Score", (row) => formatScore(row.finalScore), true],
    ["Architecture", (row) => formatScore(row.architecture), true],
    ["Populace", (row) => formatScore(row.populace), true],
    ["Site profile", (row) => formatScore(row.site), true],
    ["Completeness", (row) => formatPercent(row.completeness), false],
  ];
  const gap = completenessGap(left, right);
  return (
    <div className="space-y-4">
      {gap ? <p className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-base leading-relaxed text-amber-100">{gap}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.9375rem] uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-3 font-medium">Indicator</th>
              <th className="px-4 py-3 font-medium">{left ? <SettlementLink row={left} /> : "Settlement A"}</th>
              <th className="px-4 py-3 font-medium">{right ? <SettlementLink row={right} /> : "Settlement B"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, read, numeric]) => (
              <tr key={label} className="border-t border-zinc-800 text-lg">
                <th className="px-4 py-3 text-left text-base font-medium text-zinc-300">{label}</th>
                <td className={`px-4 py-3 ${numeric ? scoreClass(left ? read(left) === "Not available" ? null : 1 : null) : "text-white"}`}>{left ? read(left) : "—"}</td>
                <td className={`px-4 py-3 ${numeric ? scoreClass(right ? read(right) === "Not available" ? null : 1 : null) : "text-white"}`}>{right ? read(right) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-2xl border border-zinc-800 p-5">
        <summary className="cursor-pointer text-lg font-medium text-white">Subdimensions and national context</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-base">
            <tbody>
              {(
                [
                  ["Infrastructure", (row: SettlementObservation) => formatScore(row.infrastructure)],
                  ["Physical nature", (row: SettlementObservation) => formatScore(row.physicalNature)],
                  ["Compactness", (row: SettlementObservation) => formatScore(row.compactness)],
                  ["Economy", (row: SettlementObservation) => formatScore(row.economy)],
                  ["Quality of life", (row: SettlementObservation) => formatScore(row.qualityOfLife)],
                  ["Demography", (row: SettlementObservation) => formatScore(row.demography)],
                  ["National slum share", (row: SettlementObservation) => nationalShare(row, nationals)],
                ] as const
              ).map(([label, read]) => (
                <tr key={label} className="border-t border-zinc-800">
                  <th className="py-2 pr-3 text-left font-medium text-zinc-300">{label}</th>
                  <td className="py-2 pr-3 text-white">{left ? read(left) : "—"}</td>
                  <td className="py-2 text-white">{right ? read(right) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SettlementLink({ row }: { row: SettlementObservation }) {
  return (
    <Link href={`/settlements/${row.id}`} className="text-base font-semibold normal-case tracking-normal text-amber-200 underline decoration-amber-300/40 underline-offset-4">
      {row.name}
    </Link>
  );
}

function completenessGap(left: SettlementObservation | null, right: SettlementObservation | null) {
  if (!left || !right) return null;
  const a = finiteScore(left.completeness);
  const b = finiteScore(right.completeness);
  if (a === null || b === null) return "One or both profiles have no stored completeness value, so the scores should not be treated as equally documented.";
  if (Math.abs(a - b) >= 0.25) return "These profiles differ by at least 25 percentage points of completeness. Compare them as partial records, not as equivalent assessments.";
  return null;
}

function nationalShare(row: SettlementObservation, nationals: NationalContextIndicator[]) {
  const match = findNationalContext(row.country, nationals);
  if (!match?.proportion) return "Not available";
  return `${match.proportion.value.toFixed(1)}% (${match.proportion.year}, national)`;
}
