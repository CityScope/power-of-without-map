"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 15,
};

const axisTick = { fill: "#d4d4d8", fontSize: 15 };

export function ChartCard({
  title,
  explanation,
  sample,
  children,
}: {
  title: string;
  explanation: string;
  sample?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 md:p-6">
      <h3 className="text-[1.35rem] font-semibold leading-tight text-white md:text-2xl">{title}</h3>
      <p className="mt-2 text-[1.0625rem] leading-relaxed text-zinc-300">{explanation}</p>
      {sample ? <p className="mt-2 text-[0.9375rem] text-zinc-400">{sample}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-[1.0625rem] leading-relaxed text-zinc-300">{children}</p>;
}

export function VerticalBars({
  data,
  color,
  valueLabel,
}: {
  data: Array<{ range: string; count: number; percent: number }>;
  color: string;
  valueLabel: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="range" tick={axisTick} interval={0} />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, _name, item) => {
              const count = Number(value ?? 0);
              const percent = Number(item?.payload?.percent ?? 0);
              return [`${count} settlements (${percent.toFixed(0)}%)`, valueLabel];
            }}
          />
          <Bar dataKey="count" fill={color} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreScatter({
  data,
}: {
  data: Array<{ architecture: number; populace: number; name: string }>;
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="architecture" name="Architecture" domain={[0, 1]} tick={axisTick} label={{ value: "Architecture", position: "bottom", fill: "#d4d4d8", fontSize: 15 }} />
          <YAxis type="number" dataKey="populace" name="Populace" domain={[0, 1]} tick={axisTick} label={{ value: "Populace", angle: -90, position: "insideLeft", fill: "#d4d4d8", fontSize: 15 }} />
          <ZAxis range={[80, 80]} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : value, name]}
            labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.name ?? "")}
          />
          <Scatter data={data} fill="#fbbf24" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
