import Link from "next/link";

export default function DataSourcesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-3xl font-semibold">Data Sources</h1>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-zinc-300">
        <li>OpenStreetMap via Overpass API (roads, POIs, transport, facilities).</li>
        <li>UN-Habitat indicators and downloadable resources.</li>
        <li>Atlas of Informality imports via legal/manual data upload.</li>
        <li>Community/NGO field submissions and validations.</li>
      </ul>
      <div className="mt-6">
        <Link href="/data-import" className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500">
          Go to data import connection tests
        </Link>
      </div>
    </main>
  );
}
