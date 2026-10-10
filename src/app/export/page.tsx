import type { Metadata } from "next";
import { ExportCenter } from "@/components/export/ExportCenter";

export const metadata: Metadata = {
  title: "Export Data · Power of Without Map",
  description: "Download settlement records as GeoJSON, CSV, KML, Shapefile, or DXF.",
};

export default function ExportPage() {
  return <ExportCenter />;
}
