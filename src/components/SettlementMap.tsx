"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { latLngBounds } from "leaflet";
import {
  FeatureGroup,
  GeoJSON,
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  Pane,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { getSettlementMapBasemap } from "@/lib/basemapTiles";
import { buildBubbleVisuals, getSettlementInformalityScore } from "@/lib/settlementMapBubble";
import { toAreaUnits } from "@/lib/geo";
import { buildSettlementMapLayerModel, parseCentroidFromField } from "@/lib/settlementMapLayers";
import { SettlementRecord } from "@/types/settlement";
import type { UnHabitatNationalMapPayload } from "@/types/unhabitatMap";

const ATLAS_STROKE = "#ca8a04";
const ATLAS_FILL = "#facc15";
const COMMUNITY_POLY_STROKE = "#15803d";
const COMMUNITY_POLY_FILL = "#16a34a";
const COMMUNITY_MARKER_STROKE = "#15803d";
const COMMUNITY_MARKER_FILL = "#22c55e";

const SHOW_ATLAS_DEBUG =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHOW_ATLAS_DEBUG === "true";

type Props = {
  atlasSettlements: SettlementRecord[];
  communitySettlements: SettlementRecord[];
  onCreatePolygon: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
  onSelect: (settlement: SettlementRecord) => void;
  /** UN-Habitat national choropleth visibility (parent toggle only). */
  showUnHabitat: boolean;
  /** Null while loading or on error; map still shows neutral country shapes when enabled. */
  unHabitatNational: UnHabitatNationalMapPayload | null;
  className?: string;
  zoomToSettlementsTrigger?: number;
  zoomToSettlements?: SettlementRecord[];
  selectedId?: string | null;
};

function ZoomToSettlementsController({
  trigger,
  settlements,
}: {
  trigger: number | undefined;
  settlements: SettlementRecord[] | undefined;
}) {
  const map = useMap();
  useEffect(() => {
    if (!trigger || !settlements?.length) return;
    const coords: [number, number][] = [];
    for (const s of settlements) {
      const c = parseCentroidFromField(s.centroid as unknown);
      if (c && Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
        coords.push([c.coordinates[1], c.coordinates[0]]);
      }
    }
    if (!coords.length) return;
    const bounds = latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }, [map, settlements, trigger]);
  return null;
}

function InvalidateSizeController() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function InvalidateOnSettlementsController({ count }: { count: number }) {
  const map = useMap();
  useEffect(() => {
    if (count < 1) return;
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(id);
  }, [count, map]);
  return null;
}

function fillColorForPercent(pct: number, max: number) {
  const t = max > 0 ? Math.min(1, Math.max(0, pct / max)) : 0;
  const r = Math.round(39 + (109 - 39) * t);
  const g = Math.round(39 + (40 - 39) * t);
  const b = Math.round(42 + (217 - 42) * t);
  return `rgb(${r},${g},${b})`;
}

function formatInformalityScoreLine(score: number | null): string {
  if (score === null) return "Score not available";
  return `Informality Score ${score.toFixed(2)}`;
}

function formatAreaLine(areaM2: number | null): string {
  if (areaM2 === null) return "Area not available";
  return `${toAreaUnits(areaM2).hectares.toFixed(1)} ha`;
}

function SettlementCentroidPopup({ settlement, isAtlas }: { settlement: SettlementRecord; isAtlas: boolean }) {
  const score = getSettlementInformalityScore(settlement);
  const layerLabel = isAtlas ? "Atlas reference settlement" : "Community settlement";
  const actionHref = isAtlas
    ? `/settlements/${settlement.id}/summary`
    : `/edit-settlement/${settlement.id}`;
  const actionLabel = isAtlas ? "Complete profile" : "Edit Settlement";

  return (
    <div className="text-sm">
      <p className="font-semibold">{settlement.name}</p>
      <p>{[settlement.city, settlement.country].filter(Boolean).join(", ")}</p>
      <p className={isAtlas ? "text-amber-700" : "text-emerald-700"}>{layerLabel}</p>
      <p>{formatInformalityScoreLine(score)}</p>
      <a href={actionHref} className="mt-2 inline-block font-medium text-violet-700 underline hover:text-violet-900">
        {actionLabel}
      </a>
    </div>
  );
}

export function SettlementMap({
  atlasSettlements,
  communitySettlements,
  onCreatePolygon,
  onSelect,
  showUnHabitat,
  unHabitatNational,
  className,
  zoomToSettlementsTrigger,
  zoomToSettlements,
  selectedId = null,
}: Props) {
  const [worldGeo, setWorldGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  const hdxContext: UnHabitatNationalMapPayload = unHabitatNational ?? {
    source: "UN-Habitat / HDX",
    maxPercent: 1,
    byGeoName: {},
  };

  const layerModel = useMemo(
    () => buildSettlementMapLayerModel(atlasSettlements, communitySettlements),
    [atlasSettlements, communitySettlements],
  );
  const bubbleVisuals = useMemo(
    () => buildBubbleVisuals([...atlasSettlements, ...communitySettlements]),
    [atlasSettlements, communitySettlements],
  );

  const basemap = useMemo(() => getSettlementMapBasemap(), []);

  useEffect(() => {
    if (basemap.useCycleMap) return;
    console.warn(
      "Cycle map basemap requires NEXT_PUBLIC_THUNDERFOREST_API_KEY; falling back to standard OSM.",
    );
  }, [basemap.useCycleMap]);

  const settlementById = useMemo(() => {
    const m = new Map<string, SettlementRecord>();
    for (const s of atlasSettlements) m.set(s.id, s);
    for (const s of communitySettlements) m.set(s.id, s);
    return m;
  }, [atlasSettlements, communitySettlements]);

  useEffect(() => {
    if (!showUnHabitat) return;
    if (worldGeo) return;
    void fetch("/geo/countries.geo.json")
      .then((r) => r.json())
      .then((j) => setWorldGeo(j as GeoJSON.FeatureCollection));
  }, [showUnHabitat, worldGeo]);

  useEffect(() => {
    const drawButton = document.querySelector(".leaflet-draw-draw-polygon") as HTMLAnchorElement | null;
    if (drawButton) {
      drawButton.setAttribute("aria-label", "Draw settlement polygon");
      drawButton.setAttribute("title", "Draw settlement polygon");
    }
    const zoomIn = document.querySelector(".leaflet-control-zoom-in") as HTMLAnchorElement | null;
    const zoomOut = document.querySelector(".leaflet-control-zoom-out") as HTMLAnchorElement | null;
    if (zoomIn) zoomIn.setAttribute("aria-label", "Zoom in map");
    if (zoomOut) zoomOut.setAttribute("aria-label", "Zoom out map");
  }, []);

  const invalidateCount = atlasSettlements.length + communitySettlements.length;

  const settlementGeoJsonKey = `community-${layerModel.communityPolygons.length}-${layerModel.communityMarkers.length}-atlas-${layerModel.atlasPolygons.length}-${layerModel.atlasMarkers.length}`;

  return (
    <div className={`relative min-h-0 w-full ${className ?? "h-full min-h-0 w-full"}`}>
      {SHOW_ATLAS_DEBUG ? (
        <div
          className="pointer-events-none absolute bottom-4 right-4 z-[900] max-w-[16rem] rounded border border-emerald-800/70 bg-black/95 px-2 py-1.5 font-mono text-[10px] leading-snug text-emerald-100 shadow-lg"
          aria-hidden
        >
          <p className="mb-0.5 text-[9px] uppercase tracking-wide text-zinc-500">SettlementMap (dev)</p>
          <p>atlas props: {atlasSettlements.length}</p>
          <p>community props: {communitySettlements.length}</p>
          <p>layerModel.communityPolygons: {layerModel.communityPolygons.length}</p>
          <p>layerModel.communityMarkers: {layerModel.communityMarkers.length}</p>
          <p>layerModel.atlasPolygons: {layerModel.atlasPolygons.length}</p>
          <p>layerModel.atlasMarkers: {layerModel.atlasMarkers.length}</p>
        </div>
      ) : null}
      <MapContainer
        center={[16, 10]}
        zoom={3.4}
        minZoom={2}
        worldCopyJump={false}
        style={{ height: "100%", width: "100%" }}
        className="h-full min-h-0 w-full"
        aria-label="Interactive settlements map"
      >
      <InvalidateSizeController />
      <InvalidateOnSettlementsController count={invalidateCount} />
      <ZoomToSettlementsController trigger={zoomToSettlementsTrigger} settlements={zoomToSettlements} />
      <TileLayer
        key={basemap.useCycleMap ? "thunderforest-cycle" : "osm-standard"}
        url={basemap.url}
        attribution={basemap.attribution}
      />

      {showUnHabitat && worldGeo ? (
        <Pane name="unhabitat-national-choropleth" style={{ zIndex: 380 }}>
          <GeoJSON
            key="un-habitat-choropleth"
            data={worldGeo}
            style={(feature) => {
              const name = (feature as GeoJSON.Feature).properties?.name as string | undefined;
              const d = name ? hdxContext.byGeoName[name] : undefined;
              if (!d || d.percentUrbanSlums === null) {
                return {
                  fillColor: "#3f3f46",
                  fillOpacity: 0.12,
                  color: "#52525b",
                  weight: 0.4,
                };
              }
              return {
                fillColor: fillColorForPercent(d.percentUrbanSlums, hdxContext.maxPercent),
                fillOpacity: 0.6,
                color: "#3f3f46",
                weight: 0.5,
              };
            }}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.name as string | undefined;
              const d = name ? hdxContext.byGeoName[name] : undefined;
              const title = d?.displayCountry ?? name ?? "Country";
              const src = hdxContext.source;
              const pctLine =
                d?.percentUrbanSlums != null
                  ? `Urban in slums/informal: ${d.percentUrbanSlums.toFixed(1)}% (year ${d.yearPercent})`
                  : "No latest proportion in dataset";
              const totLine =
                d?.totalSlumPopulation != null
                  ? `Total in slums/informal: ${d.totalSlumPopulation.toLocaleString(undefined, { maximumFractionDigits: 0 })}${
                      d.totalUnit ? ` ${d.totalUnit}` : ""
                    } (year ${d.yearTotal ?? "—"})`
                  : "No latest total in dataset";
              const body = `${title}\n${pctLine}\n${totLine}\nSource: ${src}`;
              layer.bindTooltip(`<div class="text-xs leading-snug">${body.replaceAll("\n", "<br/>")}</div>`, {
                sticky: true,
                className: "unhabitat-geo-tooltip",
              });
              layer.bindPopup(`<div class="text-sm">${body.replaceAll("\n", "<br/>")}</div>`);
            }}
          />
        </Pane>
      ) : null}

      <FeatureGroup>
        <EditControl
          position="topleft"
          onCreated={(e) => {
            const feature = (e.layer as { toGeoJSON: () => GeoJSON.Feature }).toGeoJSON();
            if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
              onCreatePolygon(feature.geometry);
            }
          }}
          draw={{
            rectangle: false,
            marker: false,
            polyline: false,
            circle: false,
            circlemarker: false,
            polygon: true,
          }}
        />
      </FeatureGroup>

      <Pane name="settlement-polygons" style={{ zIndex: 450 }}>
        <GeoJSON
          key={settlementGeoJsonKey}
          data={layerModel.polygonCollection}
          style={(feature) => {
            const isAtlas = feature?.properties?.atlasReference === true;
            if (isAtlas) {
              return {
                color: ATLAS_STROKE,
                weight: 1.8,
                fillColor: ATLAS_FILL,
                fillOpacity: 0.32,
              };
            }
            return {
              color: COMMUNITY_POLY_STROKE,
              weight: 2,
              opacity: 0.95,
              fillColor: COMMUNITY_POLY_FILL,
              fillOpacity: 0.26,
            };
          }}
          onEachFeature={(feature, layer) => {
            layer.on("click", () => {
              const id = feature.properties?.id as string;
              const selected = settlementById.get(id);
              if (selected) onSelect(selected);
            });
          }}
        />
      </Pane>

      <Pane name="settlement-centroid-bubbles" style={{ zIndex: 470 }}>
        {layerModel.markerItems.map(({ settlement: s, isAtlas, center }) => {
          const score = getSettlementInformalityScore(s);
          const visual = bubbleVisuals.get(s.id);
          const radius = visual?.radius ?? 12;
          const coreRadius = visual?.coreRadius ?? Math.max(4, radius * 0.46);
          const selected = selectedId === s.id;
          const stroke = isAtlas ? (selected ? "#fde68a" : ATLAS_STROKE) : selected ? "#bbf7d0" : COMMUNITY_MARKER_STROKE;
          const fill = isAtlas ? ATLAS_FILL : COMMUNITY_MARKER_FILL;
          const weight = (visual?.weight ?? 1.5) + (selected ? 0.8 : 0);
          const fillOpacity = Math.min(0.72, (visual?.fillOpacity ?? 0.34) + (selected ? 0.08 : 0));
          const tooltipText = `${s.name} · ${formatAreaLine(visual?.areaM2 ?? null)} · ${formatInformalityScoreLine(score)}`;
          return (
            <Fragment key={`bubble-${s.id}`}>
              <CircleMarker
                center={center}
                radius={radius}
                pathOptions={{ color: stroke, fillColor: fill, fillOpacity: 0.16, weight, opacity: 0.95 }}
                eventHandlers={{ click: () => onSelect(s) }}
              >
                <Popup>
                  <SettlementCentroidPopup settlement={s} isAtlas={isAtlas} />
                </Popup>
                <Tooltip sticky>{tooltipText}</Tooltip>
              </CircleMarker>
              <CircleMarker
                center={center}
                radius={coreRadius}
                interactive={false}
                pathOptions={{ color: stroke, fillColor: fill, fillOpacity: Math.min(0.9, fillOpacity + 0.28), weight: 0, opacity: 0 }}
              />
            </Fragment>
          );
        })}
      </Pane>
    </MapContainer>
    </div>
  );
}
