"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QUESTIONNAIRE_QUESTIONS, type QuestionnaireQuestion } from "@/lib/questionnaireSchema";
import { indicatorLabel } from "@/lib/analyticsObservatory";
import { PAPER_TITLE, PAPER_URL } from "@/components/methodology/methodologyCopy";
import { toAreaUnits } from "@/lib/geo";
import {
  REVIEW_ACTIONS,
  buildReviewRows,
  finiteOrNull,
  isAnswered,
  reviewOverview,
  type ReviewRow,
} from "@/lib/adminReview";

const ReviewMap = dynamic(() => import("./ReviewBoundaryMap").then((module) => module.ReviewBoundaryMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-lg text-zinc-300">
      Loading map…
    </div>
  ),
});

const PAGE_SIZE = 12;
const MIT_PROJECT_URL = "https://www.media.mit.edu/projects/power-of-without-1/overview/";
const AUTHORS = ["Xinran Wang", "Maitane Iruretagoyena", "Luis Alonso Pastor", "Kent Larson"] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  verified: "Verified",
  rejected: "Rejected",
};

const fieldClass =
  "mt-2 h-12 w-full rounded-xl border border-zinc-600 bg-zinc-950 px-3 text-base text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function statusClass(status: string) {
  if (status === "submitted") return "border-amber-300/50 bg-amber-300/10 text-amber-100";
  if (status === "verified") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
  if (status === "rejected") return "border-rose-300/40 bg-rose-300/10 text-rose-100";
  if (status === "reviewed") return "border-violet-400/40 bg-violet-400/10 text-violet-100";
  return "border-zinc-600 bg-zinc-900 text-zinc-100";
}

function ScoreValue({ value, large = false }: { value: number | null; large?: boolean }) {
  const size = large ? "text-[2.5rem] md:text-[2.75rem]" : "text-[1.65rem]";
  if (value === null) {
    return <p className={`${size} font-semibold text-zinc-300`}>Not calculated</p>;
  }
  return <p className={`${size} font-semibold tabular-nums text-amber-300`}>{value.toFixed(2)}</p>;
}

function answerText(question: QuestionnaireQuestion, value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => question.options?.find((option) => String(option.value) === String(item))?.label ?? String(item))
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const option = question.options?.find((item) => String(item.value) === String(value));
  if (option) return option.label;
  if (typeof value === "number") return question.unit ? `${value} ${question.unit}` : String(value);
  return String(value);
}

function missingKeys(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function boundaryFeature(geometry: unknown): GeoJSON.Feature | null {
  if (typeof geometry !== "string" || !geometry.trim()) return null;
  try {
    const parsed = JSON.parse(geometry) as GeoJSON.Geometry;
    if (parsed.type !== "Polygon" && parsed.type !== "MultiPolygon") return null;
    return { type: "Feature", properties: {}, geometry: parsed };
  } catch {
    return null;
  }
}

export function AdminReview() {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [recordType, setRecordType] = useState<"community" | "atlas" | "all">("community");
  const [sort, setSort] = useState<"list" | "completeness-desc" | "completeness-asc" | "name">("list");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [notes, setNotes] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetch("/api/settlements", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      }),
      fetch("/api/analytics", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      }),
    ])
      .then(([listResult, analyticsResult]) => {
        if (listResult.status !== "fulfilled") throw listResult.reason;
        const analytics = analyticsResult.status === "fulfilled" ? analyticsResult.value : undefined;
        const observations =
          analytics && typeof analytics === "object" ? (analytics as { settlements?: unknown }).settlements : undefined;
        const built = buildReviewRows(listResult.value, observations);
        if (!built) throw new Error("incomplete");
        setRows(built);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/settlements/${selectedId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((record) => {
        setDetail(record);
        setNotes(typeof record.reviewerNotes === "string" ? record.reviewerNotes : "");
        setDetailState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailState("unavailable");
      });
    return () => controller.abort();
  }, [selectedId]);

  const overview = useMemo(() => (rows ? reviewOverview(rows) : null), [rows]);
  const countries = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows ?? []) {
      if (recordType === "community" && row.atlasReference) continue;
      if (recordType === "atlas" && !row.atlasReference) continue;
      names.add(row.country ?? "Unknown");
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [recordType, rows]);

  const visible = useMemo(() => {
    const filtered = (rows ?? []).filter((row) => {
      if (recordType === "community" && row.atlasReference) return false;
      if (recordType === "atlas" && !row.atlasReference) return false;
      if (status !== "all" && row.verificationStatus !== status) return false;
      if (country !== "all" && (row.country ?? "Unknown") !== country) return false;
      if (query.trim() && !row.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
    if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "completeness-desc" || sort === "completeness-asc") {
      filtered.sort((a, b) => {
        if (a.completeness === null && b.completeness === null) return 0;
        if (a.completeness === null) return 1;
        if (b.completeness === null) return -1;
        return sort === "completeness-desc" ? b.completeness - a.completeness : a.completeness - b.completeness;
      });
    }
    return filtered;
  }, [country, query, recordType, rows, sort, status]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function openReview(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailState("loading");
    setPendingStatus(null);
    setNotice(null);
    window.setTimeout(() => document.getElementById("settlement-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function applyStatus(nextStatus: string) {
    if (!selectedId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId: selectedId, verificationStatus: nextStatus, reviewerNotes: notes }),
      });
      const body = (await response.json().catch(() => null)) as { verificationStatus?: unknown; reviewerNotes?: unknown } | null;
      if (!response.ok || typeof body?.verificationStatus !== "string") {
        setNotice({ ok: false, text: "The status was not changed." });
        return;
      }
      const savedStatus = body.verificationStatus;
      const savedNotes = typeof body.reviewerNotes === "string" ? body.reviewerNotes : notes;
      setRows((current) => current?.map((row) => (row.id === selectedId ? { ...row, verificationStatus: savedStatus } : row)) ?? current);
      setNotes(savedNotes);
      setPendingStatus(null);
      setNotice({ ok: true, text: `Status is now ${statusLabel(savedStatus)}.` });
      const refreshed = await fetch(`/api/settlements/${selectedId}`);
      if (refreshed.ok) setDetail((await refreshed.json()) as Record<string, unknown>);
    } catch {
      setNotice({ ok: false, text: "The status was not changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium tracking-[0.16em] text-amber-300">ADMINISTRATION</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-[2.6rem]">Admin Review</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
          Review community contributions, assess data completeness, and manage settlement submissions.
        </p>

        <section className="mt-10" aria-label="Review overview">
          {overview ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Community submissions" value={overview.submissions} detail="Community profiles except drafts. Atlas references are separate." />
              <Metric label="Pending review" value={overview.submitted} detail="Status is submitted." highlight={overview.submitted > 0} />
              <Metric label="Verified" value={overview.verified} detail="Status is verified." />
              <Metric label="Rejected" value={overview.rejected} detail="Status is rejected." />
              <Metric
                label="Incomplete profiles"
                value={overview.incomplete}
                detail="Community profiles with stored completeness below 100%. Missing completeness is not counted."
              />
            </div>
          ) : (
            <p className="text-lg text-zinc-300">{loadState === "unavailable" ? "Review counts are unavailable." : "Loading review counts…"}</p>
          )}
          {overview ? (
            <p className="mt-4 text-base text-zinc-300">
              Also in the community records: {overview.reviewed} reviewed and {overview.drafts} drafts. Reviewed is its own status. Completeness does not decide it.
            </p>
          ) : null}
        </section>

        <section id="review-list-top" className="mt-10 scroll-mt-28" aria-label="Settlement review list">
          <h2 className="text-[1.7rem] font-semibold text-white">Settlement review list</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block text-base text-zinc-200 xl:col-span-2">
              Search by name
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className={fieldClass} placeholder="Settlement name" />
            </label>
            <label className="block text-base text-zinc-200">
              Record type
              <select value={recordType} onChange={(event) => { setRecordType(event.target.value as "community" | "atlas" | "all"); setPage(0); }} className={fieldClass}>
                <option value="community">Community contributions</option>
                <option value="atlas">Atlas references</option>
                <option value="all">All records</option>
              </select>
            </label>
            <label className="block text-base text-zinc-200">
              Review status
              <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className={fieldClass}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-base text-zinc-200">
              Country
              <select value={country} onChange={(event) => { setCountry(event.target.value); setPage(0); }} className={fieldClass}>
                <option value="all">All countries</option>
                {countries.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block max-w-md text-base text-zinc-200">
            Sort
            <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(0); }} className={fieldClass}>
              <option value="list">Recently updated first</option>
              <option value="completeness-desc">Completeness, highest first</option>
              <option value="completeness-asc">Completeness, lowest first</option>
              <option value="name">Settlement name</option>
            </select>
          </label>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-300">
            Recently updated uses the order already returned by the settlement list. That list does not include submission dates, so this page does not add a date sort. Profiles with no stored completeness stay at the end of a completeness sort.
          </p>

          <p className="mt-6 text-lg text-white">{loadState === "ready" ? `${visible.length} matching records` : loadState === "unavailable" ? "The review list is unavailable." : "Loading settlements…"}</p>
          <div className="mt-4 space-y-3">
            {pageRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[1.35rem] font-semibold text-white">{row.name}</h3>
                    <p className="mt-1 text-base text-zinc-200">{[row.city, row.country ?? "Country not recorded"].filter(Boolean).join(", ")}</p>
                    <p className="mt-1 text-base text-zinc-300">{row.atlasReference ? "Atlas reference" : "Community contribution"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-base ${statusClass(row.verificationStatus)}`}>{statusLabel(row.verificationStatus)}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-base text-zinc-300">Informality Score</p>
                    <ScoreValue value={row.finalScore} />
                  </div>
                  <div>
                    <p className="text-base text-zinc-300">Data completeness</p>
                    <p className={`text-[1.65rem] font-semibold tabular-nums ${row.completeness === null ? "text-zinc-300" : "text-violet-300"}`}>
                      {row.completeness === null ? "Not available" : `${Math.round(row.completeness * 100)}%`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => openReview(row.id)} className="mt-4 rounded-full bg-amber-300 px-5 py-2.5 text-lg font-semibold text-zinc-950">
                  Review
                </button>
              </article>
            ))}
          </div>
          {visible.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded-full border border-zinc-600 px-4 py-2 text-base text-white disabled:opacity-40">Previous</button>
              <p className="text-base text-zinc-200">Page {safePage + 1} of {pageCount}</p>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="rounded-full border border-zinc-600 px-4 py-2 text-base text-white disabled:opacity-40">Next</button>
            </div>
          ) : null}
        </section>

        <section id="settlement-review" className="mt-12 scroll-mt-28">
          {!selectedId ? (
            <p className="text-lg text-zinc-300">Select a settlement to review its profile, scores, and questionnaire.</p>
          ) : detailState !== "ready" || !detail ? (
            <p className="text-lg text-zinc-300">{detailState === "unavailable" ? "This settlement could not be opened." : "Loading settlement…"}</p>
          ) : (
            <SettlementReview
              detail={detail}
              notes={notes}
              onNotes={setNotes}
              pendingStatus={pendingStatus}
              onPending={setPendingStatus}
              busy={busy}
              notice={notice}
              onApply={(next) => void applyStatus(next)}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
                setDetailState("idle");
                setPendingStatus(null);
                setNotice(null);
                document.getElementById("review-list-top")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          )}
        </section>

        <TeamResearch />
      </div>
    </main>
  );
}

function Metric({ label, value, detail, highlight = false }: { label: string; value: number; detail: string; highlight?: boolean }) {
  return (
    <article className={`rounded-2xl border p-4 ${highlight ? "border-amber-300/50 bg-zinc-900" : "border-zinc-800 bg-zinc-900/80"}`}>
      <p className="text-base text-zinc-200">{label}</p>
      <p className={`mt-2 text-4xl font-semibold tabular-nums ${highlight ? "text-amber-300" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-base leading-snug text-zinc-300">{detail}</p>
    </article>
  );
}

function SettlementReview({
  detail,
  notes,
  onNotes,
  pendingStatus,
  onPending,
  busy,
  notice,
  onApply,
  onClose,
}: {
  detail: Record<string, unknown>;
  notes: string;
  onNotes: (value: string) => void;
  pendingStatus: string | null;
  onPending: (value: string | null) => void;
  busy: boolean;
  notice: { ok: boolean; text: string } | null;
  onApply: (status: string) => void;
  onClose: () => void;
}) {
  const score = Array.isArray(detail.calculatedScores) ? (detail.calculatedScores[0] as Record<string, unknown> | undefined) ?? null : null;
  const survey = Array.isArray(detail.surveyResponses) ? (detail.surveyResponses[0] as Record<string, unknown> | undefined) ?? null : null;
  const answers = useMemo(() => {
    try {
      const parsed = JSON.parse(typeof survey?.rawAnswersJson === "string" ? survey.rawAnswersJson : "{}") as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }, [survey]);
  const feature = boundaryFeature(detail.geometry);
  const finalScore = finiteOrNull(score?.finalInformalityScore);
  const completeness = finiteOrNull(score?.completenessScore);
  const missing = missingKeys(score?.missingVariablesJson);
  const answered = QUESTIONNAIRE_QUESTIONS.filter((question) => isAnswered(answers[question.mapsToVariable]));
  const knownVariables = new Set(QUESTIONNAIRE_QUESTIONS.map((question) => question.mapsToVariable));
  const extraAnswers = Object.entries(answers).filter(([key, value]) => !knownVariables.has(key) && isAnswered(value));
  const area = finiteOrNull(detail.areaM2);
  const population = finiteOrNull(detail.population);
  const source = typeof detail.source === "string" && detail.source.trim() ? detail.source.trim() : null;
  const warnings = [
    completeness !== null && completeness < 1 ? "Profile has incomplete questionnaire responses." : null,
    finalScore !== null && completeness !== null && completeness < 1 ? "Informality Score is a partial estimate." : null,
    !feature ? "Settlement geometry is unavailable." : null,
    !source ? "Source information is missing." : null,
  ].filter((item): item is string => Boolean(item));
  const audit = Array.isArray(detail.auditLogs) ? (detail.auditLogs as Array<Record<string, unknown>>) : [];
  const sections = [
    ["architecture", "Architecture"],
    ["populace", "Populace"],
    ["site", "Contextual site profile"],
  ] as const;

  return (
    <div className="overflow-x-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.14em] text-amber-300">SETTLEMENT REVIEW</p>
          <h2 className="mt-2 text-[1.7rem] font-semibold text-white">{String(detail.name ?? "Settlement")}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-zinc-600 px-4 py-2 text-lg text-white">
          Return to review list
        </button>
      </div>

      {warnings.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {warnings.map((warning) => (
            <li key={warning} className="rounded-xl border border-amber-300/30 bg-zinc-950 px-4 py-3 text-base text-amber-100">{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="text-[1.45rem] font-semibold text-white">Settlement profile</h3>
          <dl className="mt-4 space-y-3 text-lg">
            <Fact term="Local name" value={text(detail.localName)} />
            <Fact term="Location" value={[text(detail.city), text(detail.country)].filter((item) => item !== "Not recorded").join(", ") || "Not recorded"} />
            <Fact term="Population" value={population === null ? "Not recorded" : population.toLocaleString()} />
            <Fact term="Area" value={area === null ? "Not recorded" : `${toAreaUnits(area).km2.toFixed(3)} km²`} />
            <Fact term="Data source" value={source ?? "Not recorded"} />
            <Fact term="Source link" value={text(detail.sourceUrl)} />
            <Fact term="Contribution" value={detail.atlasReference ? "Atlas reference" : "Community contribution"} />
            <Fact term="Record created" value={dateText(detail.createdAt)} />
            <Fact term="Last updated" value={dateText(detail.updatedAt)} />
            <Fact term="Survey notes" value={text(survey?.notes)} />
          </dl>
          <Link href={`/settlements/${String(detail.id)}`} className="mt-4 inline-block text-lg text-amber-300 underline decoration-amber-300/40 underline-offset-4">
            Open the public settlement profile
          </Link>
        </section>
        <section>
          <h3 className="text-[1.45rem] font-semibold text-white">Location and boundary</h3>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-700">
            {feature && typeof detail.geometry === "string" ? (
              <ReviewMap geometryJson={detail.geometry} />
            ) : (
              <p className="p-5 text-lg text-zinc-200">No stored boundary is available to inspect.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h3 className="text-[1.45rem] font-semibold text-white">Informality profile</h3>
        <p className="mt-2 max-w-3xl text-lg text-zinc-200">These are the stored results. This page does not recalculate them. A missing result is not zero.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ScoreCard label="Informality Score" value={finalScore} note="0.5 Architecture + 0.5 Populace." />
          <ScoreCard label="Architecture" value={finiteOrNull(score?.architectureScore)} note="Included in the headline score." />
          <ScoreCard label="Populace" value={finiteOrNull(score?.populaceScore)} note="Included in the headline score." />
          <ScoreCard label="Contextual site profile" value={finiteOrNull(score?.sitePillarScore)} note="Not included in the headline score." />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreCard label="Infrastructure" value={finiteOrNull(score?.infrastructureScore)} />
          <ScoreCard label="Physical nature" value={finiteOrNull(score?.physicalNatureScore)} />
          <ScoreCard label="Compactness" value={finiteOrNull(score?.compactnessScore)} />
          <ScoreCard label="Economy" value={finiteOrNull(score?.economyScore)} />
          <ScoreCard label="Quality of life" value={finiteOrNull(score?.qualityOfLifeScore)} />
          <ScoreCard label="Demography" value={finiteOrNull(score?.demographyScore)} />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-[1.45rem] font-semibold text-white">Data completeness</h3>
        <p className="mt-3 text-[2rem] font-semibold tabular-nums text-violet-300">{completeness === null ? "Not available" : `${Math.round(completeness * 100)}%`}</p>
        <p className="mt-2 text-lg text-zinc-200">{answered.length} of {QUESTIONNAIRE_QUESTIONS.length} questionnaire questions have a stored answer.</p>
        {missing === null ? (
          <p className="mt-2 text-lg text-zinc-200">Missing indicators are not available for this record.</p>
        ) : missing.length === 0 ? (
          <p className="mt-2 text-lg text-zinc-200">No missing indicators are listed on the stored score.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-lg text-zinc-100">
            {missing.map((key) => <li key={key}>{indicatorLabel(key)}</li>)}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-[1.45rem] font-semibold text-white">Questionnaire responses</h3>
        <div className="mt-4 space-y-6">
          {sections.map(([section, title]) => {
            const questions = QUESTIONNAIRE_QUESTIONS.filter((question) => question.section === section);
            const groups = [...new Set(questions.map((question) => question.subsection))];
            return (
              <div key={section}>
                <h4 className="text-xl font-semibold text-white">{title}</h4>
                {groups.map((group) => (
                  <div key={group} className="mt-3">
                    <p className="text-base text-zinc-300">{group}</p>
                    <div className="mt-2 space-y-2">
                      {questions.filter((question) => question.subsection === group).map((question) => {
                        const value = answers[question.mapsToVariable];
                        const answeredValue = isAnswered(value);
                        return (
                          <article key={question.id} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                            <p className="text-lg text-white">{question.label}</p>
                            <p className={`mt-1 text-lg ${answeredValue ? "text-amber-200" : "text-zinc-400"}`}>
                              {answeredValue ? answerText(question, value) : "No answer stored"}
                            </p>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-base text-zinc-300">Technical mapping</summary>
                              <p className="mt-2 text-base text-zinc-200">{question.mapsToVariable}</p>
                              <p className="text-base text-zinc-200">{question.mapsToFormula}</p>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {extraAnswers.length > 0 ? (
            <div>
              <h4 className="text-xl font-semibold text-white">Other stored answers</h4>
              {extraAnswers.map(([key, value]) => (
                <p key={key} className="mt-2 text-lg text-zinc-100">{key}: {typeof value === "string" ? value : JSON.stringify(value)}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
        <h3 className="text-[1.45rem] font-semibold text-white">Review actions</h3>
        <p className="mt-2 text-lg text-zinc-200">Notes are saved together with a status. There is no separate save action.</p>
        <label className="mt-4 block text-base text-zinc-200">
          Reviewer notes
          <textarea value={notes} onChange={(event) => onNotes(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-zinc-600 bg-zinc-900 p-3 text-lg text-zinc-50" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {REVIEW_ACTIONS.map((action) => (
            <button key={action} type="button" onClick={() => onPending(action)} className="rounded-full border border-zinc-500 px-4 py-2 text-lg text-white">
              Mark {statusLabel(action).toLowerCase()}
            </button>
          ))}
        </div>
        {pendingStatus ? (
          <div className="mt-4 rounded-xl border border-amber-300/40 p-4">
            <p className="text-lg text-white">Set this settlement to {statusLabel(pendingStatus).toLowerCase()} and save the notes?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => onApply(pendingStatus)} className="rounded-full bg-amber-300 px-4 py-2 text-lg font-semibold text-zinc-950 disabled:opacity-50">
                {busy ? "Saving…" : "Confirm"}
              </button>
              <button type="button" disabled={busy} onClick={() => onPending(null)} className="rounded-full border border-zinc-500 px-4 py-2 text-lg text-white">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {notice ? <p className={`mt-4 text-lg ${notice.ok ? "text-emerald-200" : "text-rose-200"}`}>{notice.text}</p> : null}
      </section>

      <section className="mt-8">
        <h3 className="text-[1.45rem] font-semibold text-white">Moderation history</h3>
        {audit.length === 0 ? <p className="mt-3 text-lg text-zinc-200">No audit entries are stored for this settlement.</p> : (
          <div className="mt-3 space-y-3">
            {audit.map((entry, index) => (
              <article key={`${String(entry.createdAt)}-${index}`} className="rounded-xl border border-zinc-800 px-4 py-3">
                <p className="text-lg font-semibold text-white">{text(entry.action)}</p>
                <p className="text-base text-zinc-300">{dateText(entry.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap break-all text-base text-zinc-200">Previous: {jsonText(entry.oldValueJson)}</p>
                <p className="whitespace-pre-wrap break-all text-base text-zinc-200">Updated: {jsonText(entry.newValueJson)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreCard({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-base text-zinc-200">{label}</p>
      <ScoreValue value={value} large />
      {note ? <p className="mt-2 text-base text-zinc-300">{note}</p> : null}
    </article>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-base text-zinc-400">{term}</dt>
      <dd className="text-lg text-zinc-50">{value}</dd>
    </div>
  );
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Not recorded";
}

function dateText(value: unknown) {
  if (typeof value !== "string" || !value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function jsonText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Not recorded";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function TeamResearch() {
  return (
    <section className="mt-16 border-t border-zinc-800 pt-12" aria-labelledby="team-research-title">
      <h2 id="team-research-title" className="text-[1.7rem] font-semibold text-white md:text-[1.85rem]">Team & Research</h2>
      <p className="mt-3 text-lg text-zinc-200">Research authors — Taxonomy of Informality</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {AUTHORS.map((name) => (
          <article key={name} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-6">
            <h3 className="text-[1.35rem] font-semibold text-white">{name}</h3>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-base text-amber-300">Research preprint, 2022</p>
          <h3 className="mt-3 text-xl font-semibold leading-snug text-white">{PAPER_TITLE}</h3>
          <p className="mt-3 text-lg text-zinc-200">Xinran Wang, Maitane Iruretagoyena, Luis Alonso Pastor, Kent Larson.</p>
          <p className="mt-3 text-base leading-relaxed text-zinc-300">This is a research preprint. A DOI is not recorded here, and this page does not describe it as a peer-reviewed journal article.</p>
          <a href={PAPER_URL} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex rounded-full bg-amber-300 px-5 py-2.5 text-lg font-semibold text-zinc-950">
            Read the Research Paper ↗
          </a>
        </article>
        <article className="rounded-2xl border border-amber-300/30 bg-zinc-900 p-5">
          <p className="text-base text-amber-300">MIT Media Lab — City Science</p>
          <h3 className="mt-3 text-[1.6rem] font-semibold text-white">The Power of Without</h3>
          <p className="mt-3 text-lg leading-relaxed text-zinc-200">
            The Power of Without explores decentralized, accessible, and innovative approaches to improving living conditions in rapidly urbanizing communities. This research agenda provides the broader context for the study of informal settlements and community-centered urban solutions.
          </p>
          <a href={MIT_PROJECT_URL} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex rounded-full border border-amber-300 px-5 py-2.5 text-lg font-semibold text-amber-200">
            Explore The Power of Without at MIT ↗
          </a>
        </article>
      </div>
    </section>
  );
}
