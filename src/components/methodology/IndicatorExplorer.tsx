"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import {
  QUESTIONNAIRE_QUESTIONS,
  type QuestionSection,
  type QuestionnaireQuestion,
} from "@/lib/questionnaireSchema";

const SECTIONS: { id: QuestionSection; label: string }[] = [
  { id: "architecture", label: "Architecture" },
  { id: "populace", label: "Populace" },
  { id: "site", label: "Site" },
];

function subdimensionKey(question: QuestionnaireQuestion): string {
  const [head, tail] = question.subsection.split("·").map((part) => part.trim());
  if (question.section === "site") return tail || head;
  return head;
}

function subdimensionLabel(section: QuestionSection, key: string): string {
  if (section === "site") return key;
  if (key === "Physical nature") return "Physical Nature";
  if (key === "Quality of life") return "Quality of Life";
  return key;
}

function questionMatches(question: QuestionnaireQuestion, query: string): boolean {
  if (!query) return true;
  const haystack = [question.label, question.mapsToVariable, question.mapsToFormula, question.source, question.subsection]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

type Group = {
  key: string;
  label: string;
  questions: QuestionnaireQuestion[];
};

function groupsFor(section: QuestionSection, query: string): Group[] {
  const groups: Group[] = [];
  for (const question of QUESTIONNAIRE_QUESTIONS) {
    if (question.section !== section || !questionMatches(question, query)) continue;
    const key = subdimensionKey(question);
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.questions.push(question);
    else groups.push({ key, label: subdimensionLabel(section, key), questions: [question] });
  }
  return groups;
}

export function IndicatorExplorer() {
  const baseId = useId();
  const searchId = `${baseId}-search`;
  const [section, setSection] = useState<QuestionSection>("architecture");
  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<string[]>(["architecture::Infrastructure"]);
  const normalizedQuery = query.trim().toLowerCase();

  const counts = useMemo(() => {
    return Object.fromEntries(
      SECTIONS.map((item) => [
        item.id,
        QUESTIONNAIRE_QUESTIONS.filter(
          (question) => question.section === item.id && questionMatches(question, normalizedQuery),
        ).length,
      ]),
    ) as Record<QuestionSection, number>;
  }, [normalizedQuery]);

  const groups = useMemo(() => groupsFor(section, normalizedQuery), [section, normalizedQuery]);
  const searching = normalizedQuery.length > 0;
  const visibleCount = groups.reduce((sum, group) => sum + group.questions.length, 0);
  const totalCount = QUESTIONNAIRE_QUESTIONS.length;

  function groupId(key: string) {
    return `${section}::${key}`;
  }

  function isOpen(key: string) {
    return openKeys.includes(groupId(key));
  }

  function revealMatches(nextSection: QuestionSection, nextQuery: string) {
    if (!nextQuery) return;
    const matched = groupsFor(nextSection, nextQuery).map((group) => `${nextSection}::${group.key}`);
    setOpenKeys((current) => Array.from(new Set([...current, ...matched])));
  }

  function toggle(key: string) {
    const id = groupId(key);
    setOpenKeys((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function setAll(open: boolean) {
    setOpenKeys(open ? groups.map((group) => groupId(group.key)) : []);
  }

  function selectSection(nextSection: QuestionSection) {
    setSection(nextSection);
    revealMatches(nextSection, normalizedQuery);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = SECTIONS.findIndex((item) => item.id === section);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % SECTIONS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + SECTIONS.length) % SECTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SECTIONS.length - 1;
    else return;
    event.preventDefault();
    const nextSection = SECTIONS[next].id;
    selectSection(nextSection);
    document.getElementById(`${baseId}-tab-${nextSection}`)?.focus();
  }

  return (
    <div>
      <label htmlFor={searchId} className="block text-[1.125rem] font-medium text-zinc-50">
        Search questions, indicators, or variables
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          revealMatches(section, value.trim().toLowerCase());
        }}
        placeholder="Search questions, indicators, or variables..."
        className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-lg text-zinc-50 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      />
      <p className="mt-3 text-lg text-zinc-200" aria-live="polite">
        {searching
          ? `${visibleCount} matching indicator${visibleCount === 1 ? "" : "s"} in ${SECTIONS.find((item) => item.id === section)?.label}. ${totalCount} indicators are in the full mapping.`
          : `${visibleCount} indicators in this group. ${totalCount} indicators are in the full mapping.`}
      </p>

      <div
        role="tablist"
        aria-label="Indicator groups"
        className="mt-6 flex flex-wrap gap-2"
        onKeyDown={onTabKeyDown}
      >
        {SECTIONS.map((item) => {
          const selected = item.id === section;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectSection(item.id)}
              className={`rounded-full px-5 py-2.5 text-[1.125rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                selected ? "bg-amber-400 font-semibold text-zinc-950" : "border border-zinc-700 text-zinc-100 hover:border-amber-300/70 hover:text-white"
              }`}
            >
              {item.label}
              <span className={selected ? "text-zinc-800" : "text-zinc-300"}>{` · ${counts[item.id]}`}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-[1.0625rem] text-zinc-100 hover:border-amber-300/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-[1.0625rem] text-zinc-100 hover:border-amber-300/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Collapse all
        </button>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${section}`}
        aria-labelledby={`${baseId}-tab-${section}`}
        className="mt-6 space-y-4"
      >
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-8 text-lg text-zinc-100">
            No indicators in this group match that search. Try another group, or clear the search to see every question.
          </p>
        ) : (
          groups.map((group) => {
            const open = isOpen(group.key);
            const panelId = `${baseId}-${section}-${group.key.replace(/[^a-z0-9]+/gi, "-")}`;
            const buttonId = `${panelId}-button`;
            return (
              <section key={group.key} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                <h3 className="m-0">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(group.key)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 sm:px-6"
                  >
                    <span>
                      <span className="block text-2xl font-semibold text-white">{group.label}</span>
                      <span className="mt-1 block text-lg text-zinc-200">
                        {group.questions.length} question{group.questions.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-[1.125rem] text-amber-300" aria-hidden="true">
                      {open ? "Hide" : "Show"}
                    </span>
                  </button>
                </h3>
                {open ? (
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-zinc-800">
                    <p className="px-5 pt-4 text-base text-zinc-200 sm:hidden">Swipe sideways to read every column.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] border-collapse text-left text-base text-zinc-100">
                        <caption className="sr-only">
                          {group.label} questions, variables, formula layers, and sources
                        </caption>
                        <thead>
                          <tr className="border-b border-zinc-700 bg-zinc-900 text-zinc-100">
                            <th scope="col" className="px-5 py-4 text-[1.0625rem] font-semibold sm:px-6">
                              Question
                            </th>
                            <th scope="col" className="px-5 py-4 text-[1.0625rem] font-semibold sm:px-6">
                              Variable
                            </th>
                            <th scope="col" className="px-5 py-4 text-[1.0625rem] font-semibold sm:px-6">
                              Formula / dimension
                            </th>
                            <th scope="col" className="px-5 py-4 text-[1.0625rem] font-semibold sm:px-6">
                              Source
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.questions.map((question) => (
                            <tr key={question.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                              <td className="px-5 py-5 align-top leading-relaxed text-zinc-50 sm:px-6">{question.label}</td>
                              <td className="px-5 py-5 align-top sm:px-6">
                                <code className="inline-block rounded-md bg-violet-950/80 px-2 py-1 font-mono text-base text-violet-200">
                                  {question.mapsToVariable}
                                </code>
                              </td>
                              <td className="px-5 py-5 align-top leading-relaxed text-zinc-100 sm:px-6">{question.mapsToFormula}</td>
                              <td className="px-5 py-5 align-top sm:px-6">
                                <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-base text-amber-100">
                                  {question.source}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
