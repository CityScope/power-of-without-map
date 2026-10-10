import DxfWriter from "dxf-writer";
import { NextResponse } from "next/server";
import { getFilteredSettlements } from "@/lib/exportFilters";

function addPolygon(writer: DxfWriter, coordinates: number[][]) {
  const points: [number, number][] = coordinates.map(([x, y]) => [x, y]);
  writer.drawPolyline(points, true);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settlements = await getFilteredSettlements(url.searchParams);
  const writer = new DxfWriter();

  settlements.forEach((s) => {
    if (!s.geometry || !s.centroid) return;
    const geom = JSON.parse(s.geometry) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (geom.type === "Polygon") {
      addPolygon(writer, geom.coordinates[0]);
    } else {
      geom.coordinates.forEach((poly) => addPolygon(writer, poly[0]));
    }
    const center = JSON.parse(s.centroid) as GeoJSON.Point;
    const score = s.calculatedScores[0]?.finalInformalityScore;
    const scoreLabel = score === null || score === undefined ? "NA" : score.toFixed(2);
    writer.drawPoint(center.coordinates[0], center.coordinates[1]);
    writer.drawText(center.coordinates[0], center.coordinates[1], 2, 0, `${s.name} | ${s.country ?? ""} | score:${scoreLabel}`);
  });

  const dxf = writer.toDxfString();
  return new NextResponse(dxf, {
    headers: {
      "Content-Type": "application/dxf",
      "Content-Disposition": "attachment; filename=settlements.dxf",
    },
  });
}
