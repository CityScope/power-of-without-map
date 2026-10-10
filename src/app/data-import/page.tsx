import type { Metadata } from "next";
import { DataSourcesManager } from "@/components/data-import/DataSourcesManager";

export const metadata: Metadata = {
  title: "Data Sources & Imports · Power of Without Map",
  description: "Explore Atlas of Informality reference data and UN-Habitat / HDX national indicators, and run the existing import actions.",
};

export default function DataImportPage() {
  return <DataSourcesManager />;
}
