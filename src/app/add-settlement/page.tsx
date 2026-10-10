"use client";

import { SettlementWizard } from "@/components/settlement/SettlementWizard";

export default function AddSettlementPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-3 py-5 text-zinc-100 sm:px-4 lg:px-[2.5vw]">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Add settlement</h1>
        <p className="mt-3 max-w-none text-base leading-relaxed text-zinc-400">
          Guided steps: locate the area, describe the community, answer plain-language questions, then review. Missing answers stay empty and
          never count as zero in the score.
        </p>
      </div>
      <SettlementWizard mode="create" />
    </main>
  );
}
