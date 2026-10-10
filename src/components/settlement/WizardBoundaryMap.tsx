"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { Minus, Pentagon, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FeatureGroup, GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";

export type BoundaryMapPhase = "idle" | "drawing" | "editing" | "deleting";

type Props = {
  /** When user finishes a polygon. */
  onGeometry: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
  /** Optional GeoJSON string to show existing boundary. */
  geometryJson?: string | null;
  className?: string;
  onPhaseChange?: (phase: BoundaryMapPhase) => void;
  statusMessage?: string;
};

const polygonStyle = {
  color: "#a78bfa",
  weight: 3,
  fillColor: "#a78bfa",
  fillOpacity: 0.28,
};

const drawOptions = {
  rectangle: false,
  marker: false,
  polyline: false,
  circle: false,
  circlemarker: false,
  polygon: {
    shapeOptions: polygonStyle,
  },
};

const editOptions = {
  edit: {
    selectedPathOptions: {
      color: "#c4b5fd",
      weight: 3,
      fillColor: "#a78bfa",
      fillOpacity: 0.35,
    },
  },
};

/** Leaflet’s CSS loads with this module, after the global sheet, so the default bar is hidden here. */
const mapChromeCss = `
.wizard-boundary-map > .leaflet-control-container > .leaflet-top.leaflet-left {
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
.wizard-boundary-map .leaflet-div-icon.leaflet-editing-icon,
.wizard-boundary-map .leaflet-draw-guide-dash,
.wizard-boundary-map .leaflet-marker-icon.leaflet-div-icon {
  width: 14px !important;
  height: 14px !important;
  margin-left: -7px !important;
  margin-top: -7px !important;
  border: 2px solid #f5f3ff !important;
  border-radius: 999px !important;
  background: #7c3aed !important;
}
`;

function WizardMapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const refresh = () => map.invalidateSize();
    refresh();
    const id = window.setTimeout(refresh, 100);
    const observer = new ResizeObserver(refresh);
    observer.observe(map.getContainer());
    return () => {
      window.clearTimeout(id);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function visibleDrawActions(root: HTMLElement) {
  const links: HTMLAnchorElement[] = [];
  root.querySelectorAll(".leaflet-draw-actions").forEach((list) => {
    if (getComputedStyle(list).display === "none") return;
    list.querySelectorAll("a").forEach((link) => links.push(link as HTMLAnchorElement));
  });
  return links;
}

function controlEnabled(root: HTMLElement, selector: string) {
  const button = root.querySelector(selector);
  return Boolean(button && !button.classList.contains("leaflet-disabled"));
}

function BoundaryMapTools({
  onPhaseChange,
  statusMessage,
}: {
  onPhaseChange?: (phase: BoundaryMapPhase) => void;
  statusMessage?: string;
}) {
  const map = useMap();
  const [phase, setPhase] = useState<BoundaryMapPhase>("idle");
  const [actions, setActions] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const root = map.getContainer();
    const sync = () => {
      setCanEdit(controlEnabled(root, ".leaflet-draw-edit-edit"));
      setCanDelete(controlEnabled(root, ".leaflet-draw-edit-remove"));
      setActions(visibleDrawActions(root).map((link) => link.textContent?.trim() || link.getAttribute("title") || "Action"));
    };
    const setAndSync = (next: BoundaryMapPhase) => {
      setPhase(next);
      window.setTimeout(sync, 0);
      window.setTimeout(sync, 40);
    };
    const onDrawStart = () => setAndSync("drawing");
    const onDrawStop = () => setAndSync("idle");
    const onEditStart = () => setAndSync("editing");
    const onEditStop = () => setAndSync("idle");
    const onDeleteStart = () => setAndSync("deleting");
    const onDeleteStop = () => setAndSync("idle");
    const onChanged = () => window.setTimeout(sync, 0);

    map.on("draw:drawstart", onDrawStart);
    map.on("draw:drawstop", onDrawStop);
    map.on("draw:editstart", onEditStart);
    map.on("draw:editstop", onEditStop);
    map.on("draw:deletestart", onDeleteStart);
    map.on("draw:deletestop", onDeleteStop);
    map.on("draw:created", onChanged);
    map.on("draw:edited", onChanged);
    map.on("draw:deleted", onChanged);
    const nativeBar = root.querySelector(".leaflet-top.leaflet-left");
    if (nativeBar instanceof HTMLElement) nativeBar.setAttribute("aria-hidden", "true");
    const ready = window.setTimeout(sync, 0);

    return () => {
      window.clearTimeout(ready);
      map.off("draw:drawstart", onDrawStart);
      map.off("draw:drawstop", onDrawStop);
      map.off("draw:editstart", onEditStart);
      map.off("draw:editstop", onEditStop);
      map.off("draw:deletestart", onDeleteStart);
      map.off("draw:deletestop", onDeleteStop);
      map.off("draw:created", onChanged);
      map.off("draw:edited", onChanged);
      map.off("draw:deleted", onChanged);
    };
  }, [map]);

  const press = (selector: string) => {
    const button = map.getContainer().querySelector(selector) as HTMLElement | null;
    if (!button || button.classList.contains("leaflet-disabled")) return;
    button.click();
  };

  const pressAction = (index: number) => {
    visibleDrawActions(map.getContainer())[index]?.click();
  };

  const iconButton =
    "inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-950 text-zinc-50 shadow-sm hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500";
  const activeIcon = "border-amber-300 bg-amber-400 text-zinc-950 hover:text-zinc-950";

  return createPortal(
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-[1100] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-lg">
          <button type="button" className={iconButton} title="Zoom in" aria-label="Zoom in" onClick={() => map.zoomIn()}>
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" className={iconButton} title="Zoom out" aria-label="Zoom out" onClick={() => map.zoomOut()}>
            <Minus className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Draw Boundary"
            aria-label="Draw Boundary"
            aria-pressed={phase === "drawing"}
            onClick={() => press(".leaflet-draw-draw-polygon")}
            className={`inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[1.0625rem] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
              phase === "drawing" ? "bg-amber-300 text-zinc-950" : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
            }`}
          >
            <Pentagon className="h-6 w-6" aria-hidden="true" />
            Draw Boundary
          </button>
          <button
            type="button"
            className={`${iconButton} ${phase === "editing" ? activeIcon : ""}`}
            title="Edit Boundary"
            aria-label="Edit Boundary"
            aria-pressed={phase === "editing"}
            disabled={!canEdit && phase !== "editing"}
            onClick={() => press(".leaflet-draw-edit-edit")}
          >
            <Pencil className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${iconButton} ${phase === "deleting" ? activeIcon : ""}`}
            title="Delete Boundary"
            aria-label="Delete Boundary"
            aria-pressed={phase === "deleting"}
            disabled={!canDelete && phase !== "deleting"}
            onClick={() => press(".leaflet-draw-edit-remove")}
          >
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {phase !== "idle" && actions.length > 0 ? (
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-lg">
            {actions.map((label, index) => (
              <button
                key={`${label}-${index}`}
                type="button"
                onClick={() => pressAction(index)}
                className="inline-flex h-12 items-center rounded-xl border border-zinc-600 px-4 text-base font-medium text-zinc-50 hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {statusMessage ? (
        <p className="pointer-events-none absolute bottom-3 left-3 z-[1100] max-w-[min(42rem,calc(100%-7rem))] rounded-xl border border-zinc-700 bg-zinc-950/90 px-4 py-3 text-[1.0625rem] leading-snug text-zinc-100 shadow-lg">
          {statusMessage}
        </p>
      ) : null}
    </>,
    map.getContainer(),
  );
}

export function WizardBoundaryMap({ onGeometry, geometryJson, className, onPhaseChange, statusMessage }: Props) {
  const onGeometryRef = useRef(onGeometry);
  useEffect(() => {
    onGeometryRef.current = onGeometry;
  }, [onGeometry]);
  const handleCreated = useCallback((e: { layer: { toGeoJSON: () => GeoJSON.Feature } }) => {
    const feature = e.layer.toGeoJSON();
    if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
      onGeometryRef.current(feature.geometry);
    }
  }, []);
  const overlay = useMemo(() => {
    if (!geometryJson?.trim()) return null;
    try {
      const g = JSON.parse(geometryJson) as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      if (g.type !== "Polygon" && g.type !== "MultiPolygon") return null;
      return { type: "Feature" as const, properties: {}, geometry: g };
    } catch {
      return null;
    }
  }, [geometryJson]);

  return (
    <>
    <style>{mapChromeCss}</style>
    <MapContainer
      center={[15, 0]}
      zoom={2}
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
      className={`wizard-boundary-map h-full w-full ${className ?? "min-h-[320px] rounded-2xl border border-zinc-700"}`}
      aria-label="Draw settlement boundary"
    >
      <WizardMapInvalidateSize />
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FeatureGroup>
        <EditControl
          position="topleft"
          onCreated={handleCreated}
          draw={drawOptions}
          edit={editOptions}
        />
      </FeatureGroup>
      {overlay ? <GeoJSON data={overlay} style={polygonStyle} /> : null}
      <BoundaryMapTools onPhaseChange={onPhaseChange} statusMessage={statusMessage} />
    </MapContainer>
    </>
  );
}
