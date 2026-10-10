import type { Metadata } from "next";
import { MethodologyView } from "@/components/methodology/MethodologyView";
import { FORMULA_VERSION, NORMALIZATION_VERSION } from "@/lib/normalization";

export const metadata: Metadata = {
  title: "Methodology · Power of Without Map",
  description:
    "How the Atlas of Informal Settlements turns community answers into a multidimensional informality profile.",
};

export default function MethodologyPage() {
  return <MethodologyView formulaVersion={FORMULA_VERSION} normalizationVersion={NORMALIZATION_VERSION} />;
}
