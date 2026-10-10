"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";

export function ReviewBoundaryMap({ geometryJson }: { geometryJson: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let geometry: GeoJSON.Geometry;
    try {
      geometry = JSON.parse(geometryJson) as GeoJSON.Geometry;
    } catch {
      return;
    }
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return;

    const map = L.map(node).setView([15, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    const layer = L.geoJSON(geometry, {
      style: { color: "#fbbf24", weight: 2, fillColor: "#fbbf24", fillOpacity: 0.18 },
    }).addTo(map);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });

    return () => {
      map.remove();
    };
  }, [geometryJson]);

  return <div ref={containerRef} className="h-[280px] w-full" aria-label="Settlement boundary" />;
}
