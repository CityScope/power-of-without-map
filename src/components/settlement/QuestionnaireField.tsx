"use client";

import type { ReactNode } from "react";
import type { QuestionnaireQuestion } from "@/lib/questionnaireSchema";

type Props = {
  question: QuestionnaireQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
};

const controlClass =
  "h-[3.25rem] w-full max-w-xl rounded-xl border border-zinc-600 bg-zinc-950 px-4 text-lg text-zinc-50 placeholder:text-base placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

function optionSelected(current: unknown, optionValue: string | number) {
  return current === optionValue || String(current) === String(optionValue);
}

export function formatWizardAnswer(question: QuestionnaireQuestion, value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not answered";
  if (question.inputType === "select" && question.options) {
    const match = question.options.find((option) => optionSelected(value, option.value));
    return match?.label ?? String(value);
  }
  if (question.inputType === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    if (selected.length === 0) return "Not answered";
    return selected
      .map((item) => question.options?.find((option) => String(option.value) === String(item))?.label ?? String(item))
      .join(", ");
  }
  if (question.inputType === "boolean") return value ? "Yes" : "No";
  if (question.unit) return `${value} ${question.unit}`;
  return String(value);
}

function IndicatorDetails({ question }: { question: QuestionnaireQuestion }) {
  return (
    <details className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/70">
      <summary className="cursor-pointer list-none px-4 py-3 text-[0.9375rem] font-medium text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 [&::-webkit-details-marker]:hidden">
        About this indicator
      </summary>
      <dl className="space-y-2 border-t border-zinc-800 px-4 py-3 text-[0.9375rem] leading-relaxed text-zinc-300">
        <div>
          <dt className="text-zinc-400">Indicator</dt>
          <dd>{question.subsection}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Variable</dt>
          <dd className="font-mono text-[0.875rem] text-zinc-200">{question.mapsToVariable}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Formula mapping</dt>
          <dd>{question.mapsToFormula}</dd>
        </div>
        {question.expertHelp ? (
          <div>
            <dt className="text-zinc-400">Measurement</dt>
            <dd>{question.expertHelp}</dd>
          </div>
        ) : null}
        {question.unit ? (
          <div>
            <dt className="text-zinc-400">Unit</dt>
            <dd>{question.unit}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-zinc-400">Source</dt>
          <dd>{question.source}</dd>
        </div>
      </dl>
    </details>
  );
}

function QuestionFrame({ question, children }: { question: QuestionnaireQuestion; children: ReactNode }) {
  return (
    <article className="max-w-3xl space-y-3">
      <div>
        <label htmlFor={question.id} className="block text-[1.35rem] font-semibold leading-snug text-white md:text-2xl">
          {question.label}
          {question.requiredForCoreScore ? (
            <span className="ml-2 text-amber-300" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ml-3 align-middle text-base font-medium text-zinc-400">Optional</span>
          )}
        </label>
        <p id={`${question.id}-hint`} className="mt-2 text-[1.0625rem] leading-relaxed text-zinc-300">
          {question.helpText}
        </p>
      </div>
      {children}
      <IndicatorDetails question={question} />
    </article>
  );
}

export function QuestionnaireField({ question: q, value, onChange }: Props) {
  if (q.inputType === "textarea") {
    return (
      <QuestionFrame question={q}>
        <textarea
          id={q.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${q.id}-hint`}
          className="min-h-[140px] w-full max-w-3xl rounded-xl border border-zinc-600 bg-zinc-950 px-4 py-3 text-lg leading-relaxed text-zinc-50 placeholder:text-base placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        />
      </QuestionFrame>
    );
  }

  if (q.inputType === "slider") {
    const recorded = typeof value === "number" && Number.isFinite(value);
    const safe = recorded ? Math.min(100, Math.max(0, value)) : 50;
    return (
      <QuestionFrame question={q}>
        <div className="max-w-xl space-y-2">
          <div className="flex items-center justify-between text-base text-zinc-300">
            <span>0</span>
            <span className="text-lg font-semibold tabular-nums text-white">{recorded ? safe : "Not answered"}</span>
            <span>100</span>
          </div>
          <input
            id={q.id}
            type="range"
            min={0}
            max={100}
            value={safe}
            aria-describedby={`${q.id}-hint`}
            aria-valuetext={recorded ? String(safe) : "Not answered"}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-3 w-full cursor-pointer accent-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-300 [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-700 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-300"
          />
          <p className="text-[0.9375rem] leading-relaxed text-zinc-400">
            The scale stays 0–100. Moving the slider records an answer. Until then, the position is only a guide and nothing is saved.
          </p>
        </div>
      </QuestionFrame>
    );
  }

  if (q.inputType === "percentage" || q.inputType === "number") {
    const raw = value === undefined || value === null || value === "" ? "" : String(value);
    return (
      <QuestionFrame question={q}>
        <div className="flex items-center gap-3">
          <input
            id={q.id}
            type="number"
            inputMode="decimal"
            value={raw}
            aria-describedby={`${q.id}-hint`}
            onChange={(e) => {
              const next = e.target.value;
              onChange(next === "" ? undefined : Number(next));
            }}
            className={controlClass}
          />
          {q.unit ? <span className="text-lg text-zinc-200">{q.unit}</span> : null}
        </div>
      </QuestionFrame>
    );
  }

  if (q.inputType === "boolean") {
    return (
      <QuestionFrame question={q}>
        <label className="inline-flex min-h-12 items-center gap-3 text-lg text-zinc-100">
          <input
            id={q.id}
            type="checkbox"
            className="h-6 w-6 shrink-0 accent-amber-300"
            checked={Boolean(value)}
            aria-describedby={`${q.id}-hint`}
            onChange={(e) => onChange(e.target.checked)}
          />
          Yes
        </label>
      </QuestionFrame>
    );
  }

  if (q.inputType === "select" && q.options?.length) {
    const strVal = value === undefined || value === null ? "" : String(value);
    const numVal = typeof value === "number" ? value : Number.NaN;
    const selectVal = q.options.some((option) => option.value === value)
      ? String(value)
      : q.options.some((option) => String(option.value) === strVal)
        ? strVal
        : "";
    const current = selectVal === "" && Number.isFinite(numVal) ? String(numVal) : selectVal;
    return (
      <QuestionFrame question={q}>
        <fieldset aria-describedby={`${q.id}-hint`} className="max-w-3xl space-y-2">
          <legend className="sr-only">{q.label}</legend>
          <label
            className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border px-4 text-[1.125rem] leading-snug ${
              current === "" ? "border-amber-300 bg-amber-400/10 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-500"
            }`}
          >
            <input
              type="radio"
              name={q.id}
              className="h-5 w-5 shrink-0 accent-amber-300"
              checked={current === ""}
              onChange={() => onChange(undefined)}
            />
            Skip
          </label>
          {q.options.map((option) => {
            const selected = current === String(option.value);
            return (
              <label
                key={String(option.value)}
                className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border px-4 text-[1.125rem] leading-snug ${
                  selected ? "border-amber-300 bg-amber-400/10 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-500"
                }`}
              >
                <input
                  id={selected ? q.id : undefined}
                  type="radio"
                  name={q.id}
                  className="h-5 w-5 shrink-0 accent-amber-300"
                  checked={selected}
                  onChange={() => onChange(typeof option.value === "number" ? option.value : option.value)}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      </QuestionFrame>
    );
  }

  if (q.inputType === "multiselect" && q.options?.length) {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    return (
      <QuestionFrame question={q}>
        <fieldset aria-describedby={`${q.id}-hint`} className="max-w-3xl space-y-2">
          <legend className="sr-only">{q.label}</legend>
          {q.options.map((option) => {
            const key = String(option.value);
            const checked = selected.has(key);
            return (
              <label
                key={key}
                className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border px-4 text-[1.125rem] leading-snug ${
                  checked ? "border-amber-300 bg-amber-400/10 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-500"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-amber-300"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(key);
                    else next.delete(key);
                    onChange([...next]);
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      </QuestionFrame>
    );
  }

  return <p className="text-base text-amber-200">Unsupported input type for {q.id}</p>;
}
