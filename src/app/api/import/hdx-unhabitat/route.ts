import { NextResponse } from "next/server";
import { buildHdxUnHabitatImportPayload } from "@/lib/hdxUnHabitatImport";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const { mapped, proportionColumn, totalColumn } = await buildHdxUnHabitatImportPayload();
    let upserted = 0;
    for (const row of mapped) {
      await prisma.contextualIndicator.upsert({
        where: {
          source_countryCode_indicatorName_year: {
            source: row.source,
            countryCode: row.countryCode,
            indicatorName: row.indicatorName,
            year: row.year,
          },
        },
        create: {
          source: row.source,
          countryCode: row.countryCode,
          countryName: row.countryName,
          city: null,
          region: row.region,
          subRegion: row.subRegion,
          indicatorName: row.indicatorName,
          indicatorValue: row.indicatorValue,
          unit: row.unit,
          year: row.year,
          sourceUrl: row.sourceUrl,
          footnote: row.footnote,
          rawJson: row.rawJson,
        },
        update: {
          countryName: row.countryName,
          region: row.region,
          subRegion: row.subRegion,
          indicatorValue: row.indicatorValue,
          unit: row.unit,
          sourceUrl: row.sourceUrl,
          footnote: row.footnote,
          rawJson: row.rawJson,
        },
      });
      upserted++;
    }
    const years = Array.from(new Set(mapped.map((m) => m.year))).sort((a, b) => a - b);
    const countries = Array.from(new Set(mapped.map((m) => m.countryName))).sort();
    return NextResponse.json({
      ok: true,
      rowsUpserted: upserted,
      rowsPrepared: mapped.length,
      yearsCovered: years,
      countriesCovered: countries.length,
      countryNamesSample: countries.slice(0, 8),
      mappingNotes: { proportionColumn, totalColumn },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
