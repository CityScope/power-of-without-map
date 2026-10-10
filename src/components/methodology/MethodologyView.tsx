"use client";

import { useEffect, type ReactNode } from "react";
import { IndicatorExplorer } from "@/components/methodology/IndicatorExplorer";
import {
  IMPLEMENTED_FORMULAS,
  LIMITATIONS,
  PAPER_TITLE,
  PAPER_URL,
  RESEARCH_CONTRIBUTIONS,
  SCORE_STEPS,
  SOURCE_NOTES,
} from "@/components/methodology/methodologyCopy";
import { QUESTIONNAIRE_QUESTIONS } from "@/lib/questionnaireSchema";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "dimensions", label: "Dimensions" },
  { id: "scoring", label: "Scoring" },
  { id: "research", label: "Research" },
  { id: "indicators", label: "Indicators" },
  { id: "references", label: "References" },
] as const;

function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ block: "start" });
  target.focus();
}

function PaperLink({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <a href={PAPER_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const sectionOffset = "scroll-mt-[calc(var(--pow-header-offset,10.125rem)+4.75rem)]";

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1} className={`${sectionOffset} text-[1.75rem] font-semibold tracking-tight text-white outline-none md:text-[2rem]`}>
      {children}
    </h2>
  );
}

function IconArchitecture() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 27V13.5L16 5l11 8.5V27" />
      <path strokeLinecap="round" d="M5 27h22M12.5 27v-7h7v7" />
    </svg>
  );
}

function IconPopulace() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="3.2" />
      <circle cx="21" cy="12" r="2.6" />
      <path strokeLinecap="round" d="M4.5 25.5c.8-3.6 3.2-5.5 6.5-5.5s5.7 1.9 6.5 5.5M18 20.2c2.4-.3 4.6 1.2 5.6 4.3" />
    </svg>
  );
}

function IconSite() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 28s8-7.2 8-13a8 8 0 1 0-16 0c0 5.8 8 13 8 13z" />
      <circle cx="16" cy="15" r="2.4" />
    </svg>
  );
}

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

export function MethodologyView({
  formulaVersion,
  normalizationVersion,
}: {
  formulaVersion: string;
  normalizationVersion: string;
}) {
  const sources = Array.from(new Set(QUESTIONNAIRE_QUESTIONS.map((question) => question.source)));

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--pow-header-offset", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--pow-header-offset");
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header id="overview" tabIndex={-1} className={`${sectionOffset} mx-auto max-w-7xl px-5 pb-8 pt-12 outline-none md:px-8 md:pt-16`}>
        <p className="text-[1.0625rem] font-medium uppercase tracking-[0.16em] text-amber-300">Methodology</p>
        <h1 className="mt-4 max-w-4xl text-[2.25rem] font-semibold leading-tight tracking-tight text-white md:text-[2.625rem]">
          Understanding Informality
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-relaxed text-zinc-100">
          A multidimensional approach to understanding informal settlements.
        </p>
        <div className="mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-zinc-200">
          <p>
            Informality cannot be understood through a single indicator, or as a simple split between formal and informal.
          </p>
          <p>
            This methodology looks at the physical conditions of a settlement, the lives of the people who live there, and the character of the place itself.
          </p>
          <p>
            The aim is to understand and compare settlements while keeping their differences visible, and while making room for what communities report about their own lives.
          </p>
        </div>
        <PaperLink
          className={`mt-8 inline-flex items-center rounded-full bg-amber-400 px-6 py-3.5 text-[1.125rem] font-semibold text-zinc-950 hover:bg-amber-300 ${focusRing}`}
        >
          Read the Research Paper
        </PaperLink>
      </header>

      <nav
        aria-label="On this page"
        className="sticky top-[var(--pow-header-offset,10.125rem)] z-30 border-y border-zinc-800 bg-zinc-950/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 md:px-8">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[1.0625rem] text-zinc-100 hover:bg-zinc-800 hover:text-white ${focusRing}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-20 px-5 py-16 md:px-8 md:py-20">
        <section aria-labelledby="dimensions">
          <SectionTitle id="dimensions">Three dimensions of informality</SectionTitle>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
            Scores are read through Architecture and Populace. Site stays beside them as context, so a place is never reduced to one number.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/50 text-amber-300">
                <IconArchitecture />
              </span>
              <h3 className="mt-6 text-2xl font-semibold text-white">Architecture</h3>
              <p className="mt-2 text-lg text-amber-200">The physical conditions of the settlement</p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Architecture subdimensions">
                {["Infrastructure", "Physical Nature", "Compactness"].map((item) => (
                  <li key={item} className="rounded-full border border-zinc-700 px-3 py-1 text-base text-zinc-100">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-lg leading-relaxed text-zinc-200">
                This dimension describes infrastructure access, housing characteristics, and spatial conditions.
              </p>
            </article>

            <article className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/50 text-amber-300">
                <IconPopulace />
              </span>
              <h3 className="mt-6 text-2xl font-semibold text-white">Populace</h3>
              <p className="mt-2 text-lg text-amber-200">The people and their living conditions</p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Populace subdimensions">
                {["Economy", "Quality of Life", "Demography"].map((item) => (
                  <li key={item} className="rounded-full border border-zinc-700 px-3 py-1 text-base text-zinc-100">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-lg leading-relaxed text-zinc-200">
                This dimension examines economic conditions, well-being, and demographic characteristics.
              </p>
            </article>

            <article className="flex flex-col rounded-2xl border border-violet-700/50 bg-violet-950/20 p-7">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/50 text-violet-200">
                <IconSite />
              </span>
              <h3 className="mt-6 text-2xl font-semibold text-white">Site</h3>
              <p className="mt-2 text-lg text-violet-200">The place and its context</p>
              <p className="mt-4 rounded-xl border border-violet-400/40 px-4 py-3 text-base leading-relaxed text-violet-100">
                Part of the Informality Profile. Outside the headline score.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Site attributes">
                {["Origin", "Geography", "Vulnerability", "Security", "Dignity", "Community context"].map((item) => (
                  <li key={item} className="rounded-full border border-violet-800 px-3 py-1 text-base text-zinc-100">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-lg leading-relaxed text-zinc-200">
                Site conditions help contextualize a settlement: its history, its location, and its exposure to risk. Site does not contribute to the current headline Informality Score. It remains part of the broader Informality Profile.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="scoring" className="rounded-3xl border border-zinc-800 bg-zinc-900/40 px-6 py-10 md:px-10">
          <SectionTitle id="scoring">How the score works</SectionTitle>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
            Community answers move through indicators and subdimensions. Architecture and Populace become the headline score. Site travels on its own path, as context.
          </p>

          <ol className="mt-10 max-w-3xl">
            {SCORE_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-5">
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/70 text-lg font-semibold text-amber-200">
                    {index + 1}
                  </span>
                  {index < SCORE_STEPS.length - 1 ? (
                    <span className="flex flex-1 flex-col items-center py-2" aria-hidden="true">
                      <span className="w-px flex-1 bg-amber-300/40" />
                      <span className="py-1 text-lg leading-none text-amber-300">↓</span>
                      <span className="w-px flex-1 bg-amber-300/40" />
                    </span>
                  ) : null}
                </div>
                <div className={index < SCORE_STEPS.length - 1 ? "pb-8" : ""}>
                  <h3 className="text-2xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-lg leading-relaxed text-zinc-200">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-2xl border border-violet-700/40 bg-violet-950/25 p-5 md:p-6">
            <p className="text-[1.375rem] font-semibold text-white">Site → contextual Informality Profile</p>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200">
              Site indicators describe context, risk, vulnerability, and community voice. They are shown as part of the Informality Profile. A separate site pillar can be calculated from hazards, terrain, origin, position in the city, and voice. That pillar is kept beside the headline score.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-zinc-950 px-6 py-7">
            <p className="text-base font-medium uppercase tracking-[0.14em] text-amber-300">Headline formula</p>
            <p className="mt-4 text-2xl font-medium leading-snug text-amber-100 md:text-[1.75rem]">
              Informality Score = 0.5 × Architecture + 0.5 × Populace
            </p>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
              This is the formula used by the platform. Values are normalized from 0 to 1. A higher value means greater informality or deprivation.
            </p>
          </div>

          <div className="mt-8">
            <p className="text-[1.375rem] font-semibold text-white">The 0–1 scale</p>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200">
              Every combined score sits on the same scale. The left end is lower informality. The right end is greater informality and deprivation.
            </p>
            <div className="mt-5" role="img" aria-label="Scale from 0, lower informality, to 1, greater informality and deprivation.">
              <div className="h-3 rounded-full bg-gradient-to-r from-zinc-600 via-amber-500 to-amber-200" />
              <div className="mt-3 flex justify-between gap-4 text-lg text-zinc-100">
                <span>0 · lower informality</span>
                <span className="text-right">1 · greater informality</span>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
              An unanswered question is left out of its average. The other answers in that group keep their relative weights. A blank is not entered as zero. If a whole layer has no answers, that layer has no score.
            </p>
          </div>

          <details className="group mt-8 rounded-2xl border border-zinc-700 bg-zinc-950">
            <summary className={`cursor-pointer list-none px-6 py-5 text-[1.125rem] font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden ${focusRing}`}>
              <span className="flex items-center justify-between gap-4">
                Explore the detailed formulas
                <span className="text-amber-300 group-open:hidden">Show</span>
                <span className="hidden text-amber-300 group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="border-t border-zinc-800 px-6 py-6">
              <p className="max-w-3xl text-lg leading-relaxed text-zinc-200">
                These are the formulas implemented in the platform, formula version {formulaVersion}, normalization {normalizationVersion}. Where the 2022 preprint proposes a different equation, the score uses the platform version shown here.
              </p>
              <div className="mt-6 space-y-5">
                {IMPLEMENTED_FORMULAS.map((formula) => (
                  <article key={formula.title} className="rounded-xl border border-zinc-800 px-5 py-5">
                    <h3 className="text-[1.375rem] font-semibold text-white">{formula.title}</h3>
                    <p className="mt-3 text-lg leading-relaxed text-amber-100">{formula.expression}</p>
                    <p className="mt-3 text-lg leading-relaxed text-zinc-200">{formula.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </details>
        </section>

        <section aria-labelledby="research" className="rounded-3xl border border-violet-800/50 bg-gradient-to-br from-violet-950/50 to-zinc-950 px-6 py-10 md:px-10">
          <SectionTitle id="research">Built on research</SectionTitle>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-100">
            The platform builds on a multidimensional taxonomy available as a 2022 research preprint.
          </p>
          <blockquote className="mt-8 border-l-2 border-amber-300 pl-5">
            <p className="text-xl leading-relaxed text-white">{PAPER_TITLE}</p>
            <footer className="mt-4 text-lg leading-relaxed text-zinc-200">
              Wang, Xinran; Iruretagoyena, Maitane; Alonso Pastor, Luis; Larson, Kent. 2022. Research preprint.
            </footer>
          </blockquote>
          <PaperLink className={`mt-6 inline-flex text-[1.125rem] font-medium text-amber-300 underline decoration-amber-300/50 underline-offset-4 hover:text-amber-200 ${focusRing}`}>
            Read the complete paper
          </PaperLink>

          <ol className="mt-10 grid gap-4 md:grid-cols-2">
            {RESEARCH_CONTRIBUTIONS.map((item, index) => (
              <li key={item.title} className="rounded-2xl border border-violet-900/80 bg-zinc-950/50 p-5">
                <p className="text-base font-medium text-violet-200">{index + 1}</p>
                <h3 className="mt-2 text-[1.375rem] font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-zinc-200">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="platform">
          <h2 id="platform" tabIndex={-1} className={`${sectionOffset} text-[1.75rem] font-semibold tracking-tight text-white outline-none md:text-[2rem]`}>
            From research to platform
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
            The academic taxonomy is the conceptual framework. Power of Without Map implements an operational questionnaire and scoring system for practical data collection. The two are related, and they are not the same document.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <h3 className="text-2xl font-semibold text-white">Original research</h3>
              <ul className="mt-5 space-y-3 text-lg leading-relaxed text-zinc-100">
                <li>Conceptual taxonomy.</li>
                <li>Research indicators.</li>
                <li>Proposed methodological formulas.</li>
                <li>Multidimensional approach, with Site kept outside the single numerical indicator.</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-amber-400/30 bg-zinc-900/50 p-7">
              <h3 className="text-2xl font-semibold text-white">Current platform</h3>
              <ul className="mt-5 space-y-3 text-lg leading-relaxed text-zinc-100">
                <li>Community-facing questionnaire.</li>
                <li>Operational indicators stored as the variables in the table below.</li>
                <li>Implemented weights and 0–1 normalization.</li>
                <li>Interactive map and informality profiles.</li>
              </ul>
            </article>
          </div>
          <div className="mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-zinc-200">
            <p>
              The infrastructure weights match the preprint: 0.30 water, 0.30 sanitation, 0.20 energy, 0.10 connectivity, and 0.10 mobility.
            </p>
            <p>
              Other layers use the community questions and weights in the detailed formulas. In the preprint, water mixes a category of access with satisfaction. Here, water is one question about reliability. The preprint economy equation combines jobs, secured ownership, city dependence, and satisfaction. Here, economy is the six-term weighted average of unemployment, informal work, tenure insecurity, home-loss worry, daily out-commuting, and economic stress.
            </p>
            <p>
              The preprint keeps Site as qualitative context: origin, geography, vulnerability, security, and dignity. This platform also keeps Site out of the headline score. It stores those narratives, and it calculates a separate site pillar from hazard, climate tags, terrain, origin, position in the city, and community voice. Questions carry the source tags SSRN taxonomy, SW taxonomy, or derived.
            </p>
          </div>
        </section>

        <section aria-labelledby="indicators">
          <SectionTitle id="indicators">Explore the indicators</SectionTitle>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
            Discover how each community question contributes to the methodology and where its scientific foundation comes from.
          </p>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200">
            Each wizard question writes one survey variable. Variables feed the weighted formulas above. Blanks stay out of the average.
          </p>
          <div className="mt-8">
            <IndicatorExplorer />
          </div>
        </section>

        <section aria-labelledby="interpretation" className="rounded-3xl border border-zinc-800 bg-zinc-900/40 px-6 py-10 md:px-10">
          <h2 id="interpretation" tabIndex={-1} className={`${sectionOffset} text-[1.75rem] font-semibold tracking-tight text-white outline-none md:text-[2rem]`}>
            How to interpret the results
          </h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4 text-lg leading-relaxed text-zinc-200">
              <p>Informality is complex and depends on context. A numerical score cannot capture every characteristic of a settlement.</p>
              <p>Community-reported data can be incomplete. Missing values stay out of the average. They are not treated as zero, and data completeness matters when settlements are compared.</p>
              <p>Site characteristics provide essential context for history, location, and risk. Read them with the score, as part of the profile.</p>
              <p>Use the score to support understanding and informed decisions. It is a discussion aid for researchers, public agencies, and communities.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-zinc-950 p-6">
              <h3 className="text-2xl font-semibold text-white">Limits of the evidence</h3>
              <ul className="mt-4 space-y-3 text-lg leading-relaxed text-zinc-100">
                {LIMITATIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="references">
          <SectionTitle id="references">Sources and references</SectionTitle>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-200">
            Every indicator row keeps the source stored in the questionnaire. The taxonomy preprint is the primary research reference for this page.
          </p>

          <article className="mt-8 rounded-2xl border border-amber-400/30 bg-zinc-900/50 p-7">
            <p className="text-base font-medium uppercase tracking-[0.14em] text-amber-300">Primary research</p>
            <h3 className="mt-3 text-2xl font-semibold leading-snug text-white">{PAPER_TITLE}</h3>
            <p className="mt-4 text-lg leading-relaxed text-zinc-100">
              Wang, Xinran; Iruretagoyena, Maitane; Alonso Pastor, Luis; Larson, Kent. 2022. Research preprint.
            </p>
            <PaperLink className={`mt-5 inline-flex text-[1.125rem] font-medium text-amber-300 underline decoration-amber-300/50 underline-offset-4 hover:text-amber-200 ${focusRing}`}>
              Open the preprint on SSRN
            </PaperLink>
          </article>

          <h3 className="mt-10 text-2xl font-semibold text-white">Source labels on the indicator table</h3>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {sources.map((source) => (
              <li key={source} className="rounded-2xl border border-zinc-800 p-5">
                <p className="text-lg font-medium text-amber-100">{source}</p>
                <p className="mt-2 text-lg leading-relaxed text-zinc-200">
                  {SOURCE_NOTES[source] ?? "Shown exactly as recorded on the questionnaire."}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8 max-w-3xl space-y-4 text-lg leading-relaxed text-zinc-200">
            <p>
              The preprint discusses housing indicators associated with UN-Habitat, including the report The Challenge of Slums and the 2018 SDG Indicator 11.1.1 training module. Those are citations inside the paper. They are not separate source tags on the questionnaire rows.
            </p>
            <p>
              OpenStreetMap appears in the limits above because suggested map values can depend on uneven coverage. It is not a source tag on the indicator rows.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
