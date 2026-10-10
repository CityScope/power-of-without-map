"use client";

import dynamic from "next/dynamic";

export const DynamicSettlementMap = dynamic(
  () => import("./SettlementMap").then((m) => m.SettlementMap),
  { ssr: false },
);
