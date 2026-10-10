"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import { calculateAreaM2, toAreaUnits } from "@/lib/geo";
import { calculateInformalityScore } from "@/lib/informalityCalculator";
import { buildSurveyAnswersFromWizard, type WizardAnswersRecord } from "@/lib/questionnaireBridge";
import { QUESTIONNAIRE_QUESTIONS, questionsForWizardStep, WIZARD_STEP_LABELS, type QuestionnaireQuestion } from "@/lib/questionnaireSchema";
import type { InformalityScoreResult, SurveyAnswers } from "@/types/informality";
import { DynamicWizardMap } from "./MapClientMini";
import { formatWizardAnswer, QuestionnaireField } from "./QuestionnaireField";

export type WizardMeta = {
  name: string;
  localName: string;
  city: string;
  country: string;
  population: string;
  source: string;
  notes: string;
};

const STEP_INTROS: Record<number, { subtitle: string; intro: string }> = {
  3: {
    subtitle: "Understanding access to the essential services that support everyday life.",
    intro: "Tell us about water, sanitation, energy, connectivity, and transportation in this community. Estimates and local knowledge are valuable.",
  },
  4: {
    subtitle: "How homes are built, and how tightly people live together.",
    intro: "Describe housing condition, materials, construction, and crowding. An estimate is enough when an exact count is not available.",
  },
  5: {
    subtitle: "Work, tenure, and the pressure on household income.",
    intro: "Share what you know about jobs, informal work, and whether households can remain in their homes.",
  },
  6: {
    subtitle: "Wellbeing, learning, and fairness in everyday life.",
    intro: "These questions cover food, health care, rest, schooling, and whether opportunities feel fair across the community.",
  },
  7: {
    subtitle: "Where the settlement sits, what threatens it, and whether residents are heard.",
    intro: "Describe how this place formed, the hazards people face, and how the community talks about safety and dignity.",
  },
  8: {
    subtitle: "Check what you have shared before saving.",
    intro: "Review the settlement profile and the score preview. You can go back to change any earlier step. Drafts and final submission use the same actions as before.",
  },
};

function subsectionHeading(subsection: string) {
  const parts = subsection.split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ") : subsection;
}

function dimensionResult(preview: InformalityScoreResult, name: string) {
  const scores: Record<string, InformalityScoreResult["infrastructure"]> = {
    Infrastructure: preview.infrastructure,
    "Physical nature": preview.physicalNature,
    Compactness: preview.compactness,
    Economy: preview.economy,
    "Quality of life": preview.qualityOfLife,
    Demography: preview.demography,
    "Site profile": preview.sitePillar,
  };
  return scores[name] ?? null;
}

function reviewDimensions() {
  const groups = new Map<string, typeof QUESTIONNAIRE_QUESTIONS>();
  for (const question of QUESTIONNAIRE_QUESTIONS) {
    const name = question.subsection.split(" · ")[0] ?? question.subsection;
    const current = groups.get(name) ?? [];
    current.push(question);
    groups.set(name, current);
  }
  return [...groups.entries()];
}

function displayPopulation(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const count = Number(trimmed);
  return Number.isFinite(count) ? `${count.toLocaleString()} people` : trimmed;
}

const defaultMeta: WizardMeta = {
  name: "",
  localName: "",
  city: "",
  country: "",
  population: "",
  source: "",
  notes: "",
};

type Props = {
  mode: "create" | "edit";
  settlementId?: string;
  initialMeta?: Partial<WizardMeta>;
  initialGeometry?: string;
  /** Prior survey JSON to preserve unknown keys (e.g. OSM-applied fields) on save. */
  previousSurveyAnswers?: Record<string, unknown>;
  /** Initial wizard field map (usually from `surveyAnswersToWizardRaw`). */
  initialQuestionValues?: WizardAnswersRecord;
};

function scoreLabel(value: number | null) {
  return value === null ? "Not available" : value.toFixed(2);
}

function indicatorLabel(key: string) {
  return QUESTIONNAIRE_QUESTIONS.find((question) => question.mapsToVariable === key)?.label ?? key;
}

function isRecordedAnswer(value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function isNumericAnswer(question: QuestionnaireQuestion, value: unknown) {
  if (!isRecordedAnswer(value) || typeof value !== "number" || !Number.isFinite(value)) return false;
  return question.inputType === "number" || question.inputType === "percentage" || question.inputType === "slider";
}

function ScoreFigure({ value, className }: { value: number | null; className: string }) {
  return (
    <p className={`font-semibold tabular-nums leading-none tracking-tight ${value === null ? "text-zinc-400" : "text-amber-300"} ${className}`}>
      {scoreLabel(value)}
    </p>
  );
}

function ExpandChevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-6 w-6 shrink-0 text-zinc-300 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

function ScorePreview({ preview, prominent = false }: { preview: InformalityScoreResult; prominent?: boolean }) {
  const completenessPct = Math.round(preview.completeness * 100);
  const partial = preview.finalScore !== null && preview.completeness < 1;
  const headlineClass = prominent ? "text-5xl md:text-[3.5rem]" : "text-[2.75rem]";
  const dimensionClass = prominent ? "text-[2rem] md:text-[2.125rem]" : "text-[1.75rem]";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.9375rem] font-medium uppercase tracking-[0.14em] text-zinc-300">Informality Score</p>
        <ScoreFigure value={preview.finalScore} className={`mt-3 ${preview.finalScore === null ? "text-3xl" : headlineClass}`} />
        <p className="mt-4 text-base leading-relaxed text-zinc-300 md:text-[1.0625rem]">
          <InfoTip label="Estimated from available indicators" info="Architecture and Populace composite from answers so far; missing answers are excluded, not treated as zero." />
          {partial
            ? " Partial estimate based on available answers."
            : preview.finalScore === null
              ? " Not enough completed indicators for a headline score yet. Empty answers stay blank and are not treated as zero."
              : null}
        </p>
        {preview.band ? <p className="mt-2 text-base text-zinc-300">{preview.band}</p> : null}
      </div>
      <div className="space-y-4 border-t border-zinc-800 pt-5">
        {(
          [
            ["Architecture", preview.architecture.score, "Included in the headline score.", false],
            ["Populace", preview.populace.score, "Included in the headline score.", false],
            ["Site profile", preview.sitePillar.score, "Contextual. Not included in the headline score.", true],
          ] as const
        ).map(([label, value, note, contextual]) => (
          <div key={label} className={contextual ? "rounded-xl border border-dashed border-violet-400/40 bg-violet-950/20 px-4 py-3" : ""}>
            <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
            <ScoreFigure value={value} className={`mt-2 ${value === null ? "text-xl" : dimensionClass}`} />
            <p className="mt-2 text-[0.9375rem] leading-snug text-zinc-400">{note}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-800 pt-5">
        <p className="text-[0.9375rem] font-medium uppercase tracking-[0.14em] text-zinc-300">Data completeness</p>
        <p className="mt-2 text-[1.75rem] font-semibold tabular-nums leading-none text-white">{completenessPct}%</p>
        <p className="mt-2 text-base text-zinc-300">of indicators answered</p>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={completenessPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Data completeness"
        >
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${completenessPct}%` }} />
        </div>
        <p className="mt-3 text-[0.9375rem] leading-snug text-zinc-400">This is the share of score indicators with answers. It is separate from wizard progress.</p>
      </div>
      <details className="group border-t border-zinc-800 pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-medium text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 [&::-webkit-details-marker]:hidden">
          View missing indicators ({preview.missingVariables.length})
          <ExpandChevron />
        </summary>
        <ul className="mt-4 space-y-2.5 text-base leading-snug text-zinc-300">
          {preview.missingVariables.length === 0 ? <li>None</li> : preview.missingVariables.map((key) => <li key={key}>{indicatorLabel(key)}</li>)}
        </ul>
      </details>
    </div>
  );
}

function BasicQuestion({
  id,
  question,
  description,
  required = false,
  optional = false,
  children,
}: {
  id: string;
  question: string;
  description: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <label htmlFor={id} className="block text-[1.25rem] font-semibold leading-snug text-white md:text-[1.375rem]">
        {question}
        {required ? (
          <span className="ml-2 text-amber-300" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? <span className="ml-3 align-middle text-base font-medium text-zinc-400">Optional</span> : null}
      </label>
      <p id={`${id}-hint`} className="mt-2 max-w-2xl text-[1.0625rem] leading-relaxed text-zinc-300">
        {description}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function requiredCoreMissing(questionValues: WizardAnswersRecord): string[] {
  return QUESTIONNAIRE_QUESTIONS.filter((q) => q.requiredForCoreScore).filter((q) => {
    const v = questionValues[q.id];
    if (v === null || v === undefined || v === "") return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  }).map((q) => q.mapsToVariable);
}

export function SettlementWizard({
  mode,
  settlementId,
  initialMeta,
  initialGeometry,
  previousSurveyAnswers,
  initialQuestionValues,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<WizardMeta>(() => ({ ...defaultMeta, ...initialMeta }));
  const [geometry, setGeometry] = useState<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(() => {
    if (!initialGeometry?.trim()) return null;
    try {
      const g = JSON.parse(initialGeometry) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      if (g.type === "Polygon" || g.type === "MultiPolygon") return g;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [geometryJson, setGeometryJson] = useState(initialGeometry ?? "");
  const [questionValues, setQuestionValues] = useState<WizardAnswersRecord>(() => initialQuestionValues ?? {});
  const [mapPhase, setMapPhase] = useState<"idle" | "drawing" | "editing" | "deleting">("idle");
  const [reviewOpen, setReviewOpen] = useState<Record<string, boolean>>({});

  const mergedSurveyAnswers = useMemo((): SurveyAnswers => {
    const built = buildSurveyAnswersFromWizard(questionValues);
    return { ...(previousSurveyAnswers as SurveyAnswers | undefined), ...built };
  }, [questionValues, previousSurveyAnswers]);

  const preview = useMemo(() => calculateInformalityScore(mergedSurveyAnswers), [mergedSurveyAnswers]);

  const areaM2 = useMemo(() => (geometry ? calculateAreaM2(geometry) : null), [geometry]);

  const onGeometryDraw = useCallback((g: GeoJSON.Polygon | GeoJSON.MultiPolygon) => {
    setGeometry(g);
    setGeometryJson(JSON.stringify(g));
  }, []);

  const missingCore = useMemo(() => requiredCoreMissing(questionValues), [questionValues]);

  const canGoNextFromStep1 = Boolean(geometry);
  const canSubmit = Boolean(geometry && meta.name.trim().length >= 2);

  const parseApiError = async (res: Response) => {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: string };
      if (parsed.message) return parsed.message;
      if (parsed.error) return typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
      return text;
    } catch {
      return text;
    }
  };

  const persist = async (verificationStatus: "draft" | "submitted") => {
    if (!geometry) {
      window.alert("Draw a settlement boundary on the map (step 1) before saving.");
      return;
    }
    const population = meta.population.trim() === "" ? null : Math.round(Number(meta.population));
    const body = {
      name: meta.name.trim().length >= 2 ? meta.name.trim() : `Draft ${new Date().toISOString().slice(0, 16)}`,
      localName: meta.localName.trim() || null,
      city: meta.city.trim() || null,
      country: meta.country.trim() || null,
      population: Number.isFinite(population as number) ? population : null,
      source: meta.source.trim() || null,
      notes: meta.notes.trim() || null,
      geometry,
      answers: mergedSurveyAnswers,
      verificationStatus,
    };

    if (mode === "create") {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await parseApiError(res);
        alert(`Save failed: ${err}`);
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/settlements/${created.id}/summary`);
      return;
    }

    if (!settlementId) return;
    const res = await fetch(`/api/settlements/${settlementId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      alert(`Update failed: ${err}`);
      return;
    }
    router.push(`/settlements/${settlementId}/summary`);
  };

  const stepInfo = WIZARD_STEP_LABELS.find((s) => s.step === step);
  const totalSteps = 8;
  const progressPct = Math.round((step / totalSteps) * 100);

  const setQuestion = (id: string, next: unknown) => {
    setQuestionValues((prev) => {
      const copy = { ...prev };
      if (next === undefined || next === "" || (Array.isArray(next) && next.length === 0)) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const areaUnits = areaM2 !== null ? toAreaUnits(areaM2) : null;
  const questionsAnswered = QUESTIONNAIRE_QUESTIONS.filter((question) => isRecordedAnswer(questionValues[question.id])).length;
  const locationStatus =
    mapPhase === "drawing"
      ? "Click around the settlement to add points. Finish the polygon when the boundary is complete."
      : mapPhase === "editing"
        ? "Drag the corner points to adjust the boundary, then choose Save. Cancel leaves it unchanged."
        : mapPhase === "deleting"
          ? "Click the boundary, then choose Save to remove it. Cancel keeps the boundary."
          : areaUnits
            ? "Great! Your settlement boundary is ready. You can adjust it or continue."
            : "Ready to start? Select Draw Boundary to outline your settlement.";

  const fieldClass = "mt-2 w-full rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3.5 text-lg text-zinc-50 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
  const basicInput =
    "h-[3.25rem] w-full max-w-2xl rounded-xl border border-zinc-600 bg-zinc-950 px-4 text-lg text-zinc-50 placeholder:text-base placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
  const basicTextarea =
    "min-h-[140px] w-full max-w-3xl rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 text-lg leading-relaxed text-zinc-50 placeholder:text-base placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";
  const navButton =
    step >= 2
      ? "inline-flex min-h-12 items-center rounded-xl border border-zinc-600 px-5 text-[1.125rem] text-zinc-100 hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
      : "rounded-xl border border-zinc-600 px-5 py-3.5 text-[1.125rem] text-zinc-100 hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500";

  const navigation = (
    <div className={step === 8 ? "space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 md:p-8" : "flex flex-wrap items-center gap-3"}>
      {step === 8 ? (
        <div className="max-w-3xl">
          <h3 className="text-[1.65rem] font-semibold leading-tight text-white md:text-[1.85rem]">Save this review</h3>
          <p className="mt-2 text-lg leading-relaxed text-zinc-300">
            Return to an earlier step if something needs changing, save a draft, or calculate and finish with the information collected so far.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={navButton} disabled={step <= 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
        Back
      </button>
      {step < 8 ? (
        <button
          type="button"
          className={
            step === 1
              ? "rounded-xl bg-amber-400 px-6 py-3.5 text-[1.2rem] font-semibold text-zinc-950 hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              : step >= 2
                ? "inline-flex min-h-[3.25rem] items-center rounded-xl bg-amber-400 px-6 text-[1.125rem] font-semibold text-zinc-950 hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
                : "rounded-xl bg-zinc-100 px-6 py-3.5 text-[1.125rem] font-medium text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          }
          onClick={() => {
            if (step === 1 && !canGoNextFromStep1) return;
            setStep((s) => Math.min(8, s + 1));
          }}
          disabled={step === 1 && !canGoNextFromStep1}
        >
          {step === 1 ? "Continue" : "Next"}
        </button>
      ) : null}
      {step === 8 ? (
        <>
          <button type="button" className={`${navButton} min-h-[3.25rem]`} disabled={!geometry} onClick={() => void persist("draft")}>
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex min-h-14 items-center rounded-xl bg-emerald-500 px-7 text-xl font-semibold text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            disabled={!canSubmit}
            onClick={() => void persist("submitted")}
          >
            Calculate &amp; finish
          </button>
        </>
      ) : null}
      <button type="button" className={`${navButton} border-dashed text-zinc-300`} onClick={() => setStep((s) => Math.min(8, s + 1))}>
        Skip step
      </button>
      <Link href="/map" className={`ml-auto ${navButton} border-transparent text-zinc-300 hover:text-white`}>
        Cancel
      </Link>
      </div>
    </div>
  );

  return (
    <div className={step === 1 ? "w-full" : "mx-auto w-full max-w-[1680px]"}>
      <div className={step === 1 ? "flex flex-col gap-4" : "flex flex-col gap-8 lg:flex-row lg:items-start"}>
      <div className={step === 1 ? "min-w-0 space-y-4" : "min-w-0 flex-1 space-y-6"}>
        {step === 1 ? (
          <div className="space-y-2">
            <p className="text-[1.0625rem] font-medium text-zinc-200">
              Step {step} of {totalSteps}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-violet-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        ) : step === 2 ? (
          <header className="space-y-3">
            <p className="text-base font-medium uppercase tracking-wide text-zinc-200">
              Step {step} of {totalSteps} · {progressPct}% complete
            </p>
            <h2 className="text-[2.125rem] font-semibold leading-tight tracking-tight text-white md:text-[2.375rem]">Basic Information</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-100">Tell us a little about this settlement and the people who live there.</p>
            <p className="max-w-3xl text-[1.0625rem] leading-relaxed text-zinc-300">
              Estimates and local knowledge are valuable. If you don&apos;t know an answer, you can leave optional fields empty.
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-violet-500" style={{ width: `${progressPct}%` }} />
            </div>
          </header>
        ) : step === 8 ? (
          <header className="space-y-3">
            <p className="text-base font-medium uppercase tracking-[0.12em] text-zinc-200">Wizard progress: Step 8 of 8</p>
            <h2 className="text-[2.25rem] font-semibold leading-tight tracking-tight text-white md:text-[2.5rem]">Review your settlement</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-100">
              Explore the information collected, understand the calculated scores, and review any missing information before saving.
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Wizard progress"
            >
              <div className="h-full bg-violet-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[0.9375rem] leading-snug text-zinc-400">This bar tracks the eight guided steps. It is separate from how many indicators were answered.</p>
          </header>
        ) : (
          <header className="space-y-3">
            <p className="text-base font-medium uppercase tracking-wide text-zinc-200">
              Step {step} of {totalSteps} · {progressPct}% complete
            </p>
            <h2 className="text-[2.125rem] font-semibold leading-tight tracking-tight text-white md:text-[2.375rem]">{stepInfo?.title}</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-100">{STEP_INTROS[step]?.subtitle ?? stepInfo?.description}</p>
            {STEP_INTROS[step]?.intro ? <p className="max-w-3xl text-[1.0625rem] leading-relaxed text-zinc-300">{STEP_INTROS[step].intro}</p> : null}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-violet-500" style={{ width: `${progressPct}%` }} />
            </div>
          </header>
        )}

        {step === 1 && (
          <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(16rem,25%)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 md:p-6">
              <div>
                <h2 className="text-[2rem] font-semibold leading-tight tracking-tight text-white md:text-[2.25rem]">Locate your settlement</h2>
                <p className="mt-3 text-lg leading-relaxed text-zinc-100">
                  Find your community on the map and draw its approximate boundary. You can always adjust it before continuing.
                </p>
              </div>
              <ol className="space-y-4">
                {[
                  ["Find your community", "Enter the city and country, then locate your settlement on the map."],
                  ["Draw its boundary", "Select Draw Boundary and click around the settlement to outline its area."],
                  ["Review and continue", "Check the selected area, make any adjustments, and continue to the next step."],
                ].map(([title, text], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/70 text-base font-semibold text-amber-200">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[1.35rem] font-semibold leading-snug text-white">{title}</span>
                      <span className="mt-1 block text-[1.0625rem] leading-relaxed text-zinc-200">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="grid gap-4">
                <label className="text-lg font-medium text-zinc-50">
                  City / municipality
                  <input
                    value={meta.city}
                    onChange={(e) => setMeta((m) => ({ ...m, city: e.target.value }))}
                    className={fieldClass}
                    placeholder="e.g. Medellín"
                  />
                </label>
                <label className="text-lg font-medium text-zinc-50">
                  Country
                  <input
                    value={meta.country}
                    onChange={(e) => setMeta((m) => ({ ...m, country: e.target.value }))}
                    className={fieldClass}
                    placeholder="e.g. Colombia"
                  />
                </label>
              </div>
              <p className="rounded-xl border border-amber-400/30 bg-zinc-950 px-4 py-3 text-[1.0625rem] leading-relaxed text-amber-100" aria-live="polite">
                {locationStatus}
              </p>
              {areaUnits ? (
                <p className="rounded-xl border border-violet-400/40 bg-violet-950/30 px-4 py-3 text-lg text-zinc-50">
                  Selected area: <strong>{areaUnits.hectares.toFixed(2)} ha</strong> ({areaUnits.km2.toFixed(3)} km²)
                </p>
              ) : (
                <p className="text-lg text-zinc-200">Draw a boundary to continue.</p>
              )}
            </div>
            <div className="h-[min(72vw,56vh)] min-h-[280px] w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 sm:h-[min(62vw,60vh)] sm:min-h-[400px] lg:h-[clamp(550px,72vh,860px)] lg:min-h-[550px]">
              <DynamicWizardMap
                onGeometry={onGeometryDraw}
                geometryJson={geometryJson || null}
                onPhaseChange={setMapPhase}
                statusMessage={locationStatus}
                className="h-full w-full rounded-none border-0"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <section className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
              <div className="max-w-3xl">
                <h3 className="text-2xl font-semibold leading-tight text-white md:text-[1.75rem]">Tell us about the settlement</h3>
                <p className="mt-2 text-lg leading-relaxed text-zinc-300">
                  Let&apos;s start with some basic information about the community. You don&apos;t need to know everything — provide what you can.
                </p>
              </div>
              <BasicQuestion
                id="settlement-name"
                question="What is the name of the settlement?"
                description="Enter the official or most commonly used name of the settlement."
                required
              >
                <input
                  id="settlement-name"
                  value={meta.name}
                  onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
                  className={basicInput}
                  placeholder="e.g. Settlement name"
                  aria-describedby="settlement-name-hint"
                  required
                  minLength={2}
                />
              </BasicQuestion>
              <BasicQuestion
                id="settlement-local-name"
                question="Does the community have another local name?"
                description="Some settlements are known by different names locally. Add one if applicable."
                optional
              >
                <input
                  id="settlement-local-name"
                  value={meta.localName}
                  onChange={(e) => setMeta((m) => ({ ...m, localName: e.target.value }))}
                  className={basicInput}
                  placeholder="Local or alternative name"
                  aria-describedby="settlement-local-name-hint"
                />
              </BasicQuestion>
              <BasicQuestion
                id="settlement-population"
                question="Approximately how many people live here?"
                description="An estimate is fine. You do not need an exact population count."
                optional
              >
                <input
                  id="settlement-population"
                  value={meta.population}
                  onChange={(e) => setMeta((m) => ({ ...m, population: e.target.value }))}
                  type="number"
                  className={basicInput}
                  placeholder="e.g. 2,500"
                  aria-describedby="settlement-population-hint"
                />
              </BasicQuestion>
            </section>
            <section className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
              <div className="max-w-3xl">
                <h3 className="text-2xl font-semibold leading-tight text-white md:text-[1.75rem]">Help us understand your information</h3>
                <p className="mt-2 text-lg leading-relaxed text-zinc-300">
                  Knowing where information comes from helps others interpret and trust the settlement profile.
                </p>
              </div>
              <BasicQuestion
                id="settlement-source"
                question="Where does this information come from?"
                description="For example, community knowledge, a local organization, a survey, or official records."
                optional
              >
                <input
                  id="settlement-source"
                  value={meta.source}
                  onChange={(e) => setMeta((m) => ({ ...m, source: e.target.value }))}
                  className={basicInput}
                  placeholder="e.g. Community survey, local NGO, government records"
                  aria-describedby="settlement-source-hint"
                />
              </BasicQuestion>
              <BasicQuestion
                id="settlement-notes"
                question="Is there anything else we should know?"
                description="Share useful context, uncertainties, or additional information that could help us understand the settlement."
                optional
              >
                <textarea
                  id="settlement-notes"
                  value={meta.notes}
                  onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
                  className={basicTextarea}
                  placeholder="Add any additional notes here..."
                  aria-describedby="settlement-notes-hint"
                />
              </BasicQuestion>
            </section>
          </div>
        )}

        {step >= 3 && step <= 7 && (
          <div className="space-y-6">
            {Array.from(
              questionsForWizardStep(step).reduce((groups, question) => {
                const heading = subsectionHeading(question.subsection);
                const current = groups.get(heading) ?? [];
                current.push(question);
                groups.set(heading, current);
                return groups;
              }, new Map<string, ReturnType<typeof questionsForWizardStep>>()),
            ).map(([heading, questions]) => (
              <section key={heading} className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
                <h3 className="text-2xl font-semibold leading-tight text-white md:text-[1.75rem]">{heading}</h3>
                {questions.map((question) => (
                  <QuestionnaireField key={question.id} question={question} value={questionValues[question.id]} onChange={(next) => setQuestion(question.id, next)} />
                ))}
              </section>
            ))}
          </div>
        )}

        {step === 8 && (
          <div className="space-y-8">
            <section className="space-y-4">
              <article className="rounded-2xl border border-amber-300/30 bg-zinc-900/80 p-6 md:p-8">
                <p className="text-[0.9375rem] font-medium uppercase tracking-[0.14em] text-zinc-300">Informality Score</p>
                <ScoreFigure
                  value={preview.finalScore}
                  className={preview.finalScore === null ? "mt-3 text-4xl" : "mt-3 text-5xl md:text-[3.5rem]"}
                />
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-300">
                  {preview.finalScore === null
                    ? "Not enough completed indicators for a headline score yet. Empty answers stay blank and are not treated as zero."
                    : preview.completeness < 1
                      ? "Partial estimate based on available answers."
                      : "Estimated from the completed Architecture and Populace indicators."}
                </p>
                {preview.band ? <p className="mt-2 text-base text-zinc-300">{preview.band}</p> : null}
              </article>
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["Architecture", preview.architecture.score, "Part of the headline score."],
                    ["Populace", preview.populace.score, "Part of the headline score."],
                  ] as const
                ).map(([label, value, note]) => (
                  <article key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                    <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</p>
                    <ScoreFigure value={value} className={value === null ? "mt-3 text-2xl" : "mt-3 text-[1.75rem] md:text-[2.125rem]"} />
                    <p className="mt-3 text-base leading-snug text-zinc-400">{note}</p>
                  </article>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-dashed border-violet-400/40 bg-violet-950/20 p-6">
                  <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">Site</p>
                  <ScoreFigure
                    value={preview.sitePillar.score}
                    className={preview.sitePillar.score === null ? "mt-3 text-2xl" : "mt-3 text-[1.75rem] md:text-[2.125rem]"}
                  />
                  <p className="mt-3 text-base leading-snug text-zinc-300">Contextual profile. Not part of the headline score.</p>
                </article>
                <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                  <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">Data completeness</p>
                  <p className="mt-3 text-[1.75rem] font-semibold tabular-nums leading-none text-white md:text-[2.125rem]">
                    {Math.round(preview.completeness * 100)}%
                  </p>
                  <p className="mt-3 text-base leading-snug text-zinc-300">of indicators answered</p>
                  <div
                    className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-800"
                    role="progressbar"
                    aria-valuenow={Math.round(preview.completeness * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Data completeness"
                  >
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(preview.completeness * 100)}%` }} />
                  </div>
                  <p className="mt-3 text-[0.9375rem] leading-snug text-zinc-400">This is not the same as finishing the eight wizard steps.</p>
                </article>
              </div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
              <h3 className="text-[1.65rem] font-semibold text-white md:text-[1.85rem]">Settlement profile</h3>
              <dl className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2">
                {(
                  [
                    ["Location", [meta.city, meta.country].filter(Boolean).join(", "), false],
                    ["Name", meta.name, false],
                    ["Local name", meta.localName, false],
                    ["Population", displayPopulation(meta.population), true],
                    ["Area", areaM2 !== null ? `${toAreaUnits(areaM2).hectares.toFixed(2)} ha (${toAreaUnits(areaM2).km2.toFixed(3)} km²)` : null, true],
                    ["Data source", meta.source, false],
                    ["Questions answered", `${questionsAnswered} of ${QUESTIONNAIRE_QUESTIONS.length}`, true],
                  ] as const
                ).map(([label, value, emphasize]) => (
                  <div key={label}>
                    <dt className="text-base font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</dt>
                    <dd className={`mt-2 text-[1.375rem] font-semibold leading-snug md:text-2xl ${value && emphasize ? "text-amber-300" : value ? "text-white" : "text-xl font-medium text-zinc-500"}`}>
                      {value || "Not provided"}
                    </dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-base font-medium uppercase tracking-[0.12em] text-zinc-400">Notes</dt>
                  <dd className={`mt-2 text-lg leading-relaxed ${meta.notes.trim() ? "text-white" : "text-zinc-500"}`}>{meta.notes.trim() || "Not provided"}</dd>
                </div>
              </dl>
            </section>
            {reviewDimensions().map(([name, questions]) => {
              const answered = questions.filter((question) => isRecordedAnswer(questionValues[question.id])).length;
              const section = dimensionResult(preview, name);
              const subgroups = new Map<string, typeof questions>();
              for (const question of questions) {
                const heading = subsectionHeading(question.subsection);
                const current = subgroups.get(heading) ?? [];
                current.push(question);
                subgroups.set(heading, current);
              }
              const expanded = reviewOpen[name] ?? answered > 0;
              return (
                <details
                  key={name}
                  open={expanded}
                  onToggle={(event) => {
                    const next = event.currentTarget.open;
                    setReviewOpen((prev) => (prev[name] === next ? prev : { ...prev, [name]: next }));
                  }}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8"
                >
                  <summary className="cursor-pointer list-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 [&::-webkit-details-marker]:hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-[1.65rem] font-semibold leading-tight text-white md:text-[1.85rem]">{name}</h3>
                          <p className="mt-2 text-base text-zinc-300">
                            {answered} of {questions.length} questions answered
                          </p>
                          {name === "Site profile" ? (
                            <p className="mt-1 text-base text-zinc-400">Contextual profile. Not included in the headline score.</p>
                          ) : null}
                        </div>
                        {section ? (
                          <div className="text-left sm:text-right">
                            <p className="text-[0.9375rem] font-medium uppercase tracking-[0.12em] text-zinc-400">Section score</p>
                            <ScoreFigure value={section.score} className={section.score === null ? "mt-2 text-2xl" : "mt-2 text-[1.75rem] md:text-[2.125rem]"} />
                          </div>
                        ) : null}
                      </div>
                      <ExpandChevron />
                    </div>
                  </summary>
                  <div className="mt-6 space-y-8">
                    {[...subgroups.entries()].map(([heading, items]) => (
                      <div key={heading}>
                        {heading !== name ? <h4 className="text-[1.375rem] font-semibold text-white md:text-2xl">{heading}</h4> : null}
                        <ul className={heading !== name ? "mt-4 space-y-3" : "space-y-3"}>
                          {items.map((question) => {
                            const recorded = isRecordedAnswer(questionValues[question.id]);
                            const numeric = isNumericAnswer(question, questionValues[question.id]);
                            return (
                              <li
                                key={question.id}
                                className={`rounded-xl border px-5 py-5 ${recorded ? "border-zinc-700 bg-zinc-950/70" : "border-dashed border-zinc-800 bg-zinc-950/30"}`}
                              >
                                <p className="text-lg font-semibold leading-snug text-white md:text-xl">{question.label}</p>
                                <p
                                  className={
                                    numeric
                                      ? "mt-3 text-[1.625rem] font-semibold tabular-nums leading-none text-amber-300"
                                      : recorded
                                        ? "mt-3 text-[1.375rem] font-semibold leading-snug text-white"
                                        : "mt-3 text-lg font-medium text-zinc-500"
                                  }
                                >
                                  {recorded ? formatWizardAnswer(question, questionValues[question.id]) : "Not answered"}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
            <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-lg leading-relaxed text-zinc-300 md:p-8">
              {missingCore.length > 0 ? (
                <p className="text-amber-200">
                  Required-for-core variables still missing: {missingCore.map((key) => indicatorLabel(key)).join(", ") || "none"} (you may still save a draft.)
                </p>
              ) : (
                <p className="text-emerald-300">All core-required questions are filled.</p>
              )}
              <p>This score is indicative and depends on data completeness and source quality.</p>
            </section>
          </div>
        )}

        {navigation}
      </div>

      {step === 1 ? (
        <details className="group mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-xl font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 [&::-webkit-details-marker]:hidden">
            Informality Score preview
            <ExpandChevron />
          </summary>
          <div className="border-t border-zinc-800 px-5 py-5 md:px-6">
            <ScorePreview preview={preview} />
          </div>
        </details>
      ) : step === 2 ? (
      <aside className="w-full shrink-0 lg:w-[28%] lg:max-w-[24rem]">
        <div className="sticky top-[6.5rem] space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 md:p-6">
          <h3 className="text-xl font-semibold text-white">Informality Score preview</h3>
          <ScorePreview preview={preview} />
          {geometry ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <DynamicWizardMap onGeometry={onGeometryDraw} geometryJson={geometryJson || null} className="h-44 w-full rounded-none border-0" />
              <p className="border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-base text-zinc-300">Boundary summary</p>
            </div>
          ) : null}
        </div>
      </aside>
      ) : (
      <aside className={step === 8 ? "w-full shrink-0 lg:w-[28%] lg:max-w-[26rem]" : "w-full shrink-0 lg:w-[28%] lg:max-w-[24rem]"}>
        <div className={`sticky top-[6.5rem] rounded-2xl border border-zinc-800 bg-zinc-900/80 ${step === 8 ? "space-y-6 p-6 md:p-7" : "space-y-5 p-5 md:p-6"}`}>
          <h3 className={step === 8 ? "text-2xl font-semibold text-white" : "text-xl font-semibold text-white"}>Informality Score preview</h3>
          <ScorePreview preview={preview} prominent={step === 8} />
          {geometry ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <DynamicWizardMap onGeometry={onGeometryDraw} geometryJson={geometryJson || null} className="h-44 w-full rounded-none border-0" />
              <p className="border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-base text-zinc-300">Boundary summary</p>
            </div>
          ) : null}
        </div>
      </aside>
      )}
      </div>
    </div>
  );
}
