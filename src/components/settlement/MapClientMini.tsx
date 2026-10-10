"use client";

import dynamic from "next/dynamic";

export const DynamicWizardMap = dynamic(
  () => import("./WizardBoundaryMap").then((m) => m.WizardBoundaryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-lg text-zinc-300">
        Loading map…
      </div>
    ),
  },
);
