import type { Metadata } from "next";
import { InformalityObservatory } from "@/components/analytics/InformalityObservatory";

export const metadata: Metadata = {
  title: "Observatory · Power of Without Map",
  description: "Explore documented informal settlements, their scores, missing evidence, and national UN-Habitat context.",
};

export default function AnalyticsPage() {
  return <InformalityObservatory />;
}
