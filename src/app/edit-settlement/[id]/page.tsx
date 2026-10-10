"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SettlementWizard } from "@/components/settlement/SettlementWizard";
import { surveyAnswersToWizardRaw } from "@/lib/questionnaireBridge";

export default function EditSettlementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [geometryText, setGeometryText] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, unknown>>({});
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, unknown>>({});
  const [suggestedMeta, setSuggestedMeta] = useState<
    Record<string, { confidence: "high" | "medium" | "low"; explanation: string; basis: string }>
  >({});
  const [report, setReport] = useState<{ roadsFound?: number; buildingsFound?: number; servicesFound?: number; gaps?: string[]; enrichedAt?: string }>({});
  const [accepted, setAccepted] = useState<string[]>([]);

  const loadSettlement = useCallback(async () => {
    const data = await fetch(`/api/settlements/${id}`).then((r) => r.json());
    const answers = JSON.parse(data.surveyResponses?.[0]?.rawAnswersJson ?? "{}") as Record<string, unknown>;
    setRecord(data);
    setCurrentAnswers(answers);
    setGeometryText(data.geometry);
    const latest = data.enrichments?.[data.enrichments.length - 1];
    setSuggestions(JSON.parse(latest?.suggestedValuesJson ?? "{}"));
    setSuggestedMeta(JSON.parse(latest?.atlasJson ?? "{}"));
    setReport(JSON.parse(latest?.beamJson ?? "{}"));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load settlement on mount / id change
    void loadSettlement();
  }, [loadSettlement]);

  const initialQuestionValues = useMemo(() => surveyAnswersToWizardRaw(currentAnswers), [currentAnswers]);

  const wizardMeta = useMemo(() => {
    if (!record) return undefined;
    const responses = record.surveyResponses as Array<{ notes?: string | null }> | undefined;
    const latest = responses?.[0];
    return {
      name: String(record.name ?? ""),
      localName: String(record.localName ?? ""),
      city: String(record.city ?? ""),
      country: String(record.country ?? ""),
      population: record.population !== null && record.population !== undefined ? String(record.population) : "",
      source: String(record.source ?? ""),
      notes: String(latest?.notes ?? ""),
    };
  }, [record]);

  if (!record) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <p className="text-zinc-400">Loading settlement for editing…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      <h1 className="mb-2 text-3xl font-semibold">Edit settlement</h1>
      <p className="mb-6 max-w-none text-base leading-relaxed text-zinc-400">
        Use the same guided wizard. Open-data enrichment and suggestions stay below the form.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/map" className="rounded bg-zinc-700 px-3 py-1.5 text-sm">
          Back to Map
        </Link>
        <Link href={`/settlements/${id}`} className="rounded border border-zinc-700 px-3 py-1.5 text-sm">
          View Profile
        </Link>
        <Link href="/methodology" className="rounded border border-zinc-700 px-3 py-1.5 text-sm">
          Methodology
        </Link>
        {record.atlasReference === true ? (
          <p className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400">
            Atlas reference records cannot be deleted here. They can be hidden with the layer toggle.
          </p>
        ) : (
          <button
            type="button"
            className="rounded border border-rose-700 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200"
            onClick={async () => {
              const ok = window.confirm(`Delete community settlement "${String(record.name ?? "")}"? This cannot be undone.`);
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

      <SettlementWizard
        mode="edit"
        settlementId={id}
        initialMeta={wizardMeta}
        initialGeometry={geometryText}
        initialQuestionValues={initialQuestionValues}
        previousSurveyAnswers={currentAnswers}
      />

      <div className="mt-10 space-y-6">
        <div className="flex gap-2">
          <button
            aria-label="Enrich with Open Data"
            type="button"
            onClick={async () => {
              await fetch(`/api/settlements/${id}/enrich`, { method: "POST" });
              await loadSettlement();
            }}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-black"
          >
            Enrich with Open Data
          </button>
        </div>

        {Object.keys(suggestions).length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <h3 className="mb-2 font-semibold text-zinc-200">Suggested values</h3>
            {Object.entries(suggestions).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between gap-4 py-2">
                <span>
                  <span className="font-mono text-xs text-violet-300">{key}</span>: {String(value)}{" "}
                  <span className="text-zinc-500">
                    ({currentAnswers[key] !== undefined && currentAnswers[key] !== null ? "User provided" : "Open data suggested"}, confidence:{" "}
                    {suggestedMeta[key]?.confidence ?? "low"})
                  </span>
                  <br />
                  <span className="text-xs text-zinc-600">{suggestedMeta[key]?.explanation ?? "Derived from polygon-filtered OSM."}</span>
                </span>
                <input
                  aria-label={`Accept suggested value for ${key}`}
                  type="checkbox"
                  checked={accepted.includes(key)}
                  onChange={(e) => {
                    setAccepted((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)));
                  }}
                />
              </label>
            ))}
            <button
              aria-label="Accept Suggestions"
              type="button"
              onClick={async () => {
                const rejectedKeys = Object.keys(suggestions).filter((k) => !accepted.includes(k));
                await fetch(`/api/settlements/${id}/apply-suggestions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ acceptedKeys: accepted, rejectedKeys }),
                });
                setAccepted([]);
                await loadSettlement();
              }}
              className="mt-3 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-black"
            >
              Accept suggestions
            </button>
          </div>
        )}

        {Object.keys(suggestions).length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
            No open-data suggestions yet. Use <span className="text-zinc-300">Enrich with Open Data</span> to generate them.
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          <h3 className="mb-2 font-semibold text-zinc-100">Enrichment report</h3>
          <p>OSM roads found: {report.roadsFound ?? 0}</p>
          <p>Buildings found: {report.buildingsFound ?? 0}</p>
          <p>Services found: {report.servicesFound ?? 0}</p>
          <p>Missing / gaps: {(report.gaps ?? []).length ? (report.gaps ?? []).join("; ") : "None"}</p>
          <p>Enriched at: {report.enrichedAt ?? "N/A"}</p>
        </div>
      </div>
    </main>
  );
}
