"use client";

export function InfoTip({ label, info }: { label: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        title={info}
        role="img"
        aria-label={`${label} information: ${info}`}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-200"
      >
        ?
      </span>
    </span>
  );
}
