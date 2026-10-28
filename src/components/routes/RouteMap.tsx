import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Polygon, Circle, CircleMarker, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { zoneShapes } from "@/lib/airspace";
import type { Road } from "@/lib/conditions";
import type { LatLon, RouteResult, Venue } from "@/lib/routeRisk";

const COLORS = { go: "#4FB286", caution: "#E0A84A", nogo: "#E5574F" } as const;
const LABEL = { go: "GO", caution: "CAUTION", nogo: "NO-GO" } as const;

function ClickToAdd({ onAdd, enabled }: { onAdd: (p: LatLon) => void; enabled: boolean }) {
  useMapEvents({ click: (e) => { if (enabled) onAdd([+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)]); } });
  return null;
}

/** Leaflet only measures its box once; re-measure whenever the layout changes so tiles fill it. */
function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map]);
  return null;
}

/** Aerodrome flight restriction zones (red) and other airfields (amber) around the route and the current view. */
function AirspaceLayer({ points }: { points: LatLon[] }) {
  const map = useMap();
  const read = () => { const b = map.getBounds(); return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), z: map.getZoom() }; };
  const [view, setView] = useState(read);
  useMapEvents({ moveend: () => setView(read()), zoomend: () => setView(read()), viewreset: () => setView(read()) });
  const shapes = useMemo(() => {
    if (view.z < 8 && points.length < 2) return [];
    const lats = points.map((p) => p[0]), lons = points.map((p) => p[1]);
    const b = view.z >= 8 ? { s: view.s, w: view.w, n: view.n, e: view.e } : { s: Infinity, w: Infinity, n: -Infinity, e: -Infinity };
    if (points.length) { b.s = Math.min(b.s, ...lats); b.n = Math.max(b.n, ...lats); b.w = Math.min(b.w, ...lons); b.e = Math.max(b.e, ...lons); }
    return zoneShapes(b);
  }, [view, points]);
  return (
    <>
      {shapes.map((z, i) => {
        const frz = z.level === "frz";
        const style = frz
          ? { color: "#E5574F", weight: 1, opacity: 0.7, fillColor: "#E5574F", fillOpacity: 0.12 }
          : { color: "#E0A84A", weight: 1, opacity: 0.6, dashArray: "4 4", fillColor: "#E0A84A", fillOpacity: 0.05 };
        const tip = <Tooltip className="wm-tip" sticky>{frz ? `${z.name}: flight restriction zone (permission needed)` : `${z.name} airfield: check before flying`}</Tooltip>;
        return z.kind === "circle"
          ? <Circle key={`${z.id}-${i}`} center={z.c!} radius={z.rM!} pathOptions={style}>{tip}</Circle>
          : <Polygon key={`${z.id}-${i}`} positions={z.poly!} pathOptions={style}>{tip}</Polygon>;
      })}
    </>
  );
}

function FitTo({ points, token }: { points: LatLon[]; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0]!, 14);
    // Only refit when the route is replaced (preset/upload), not on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return null;
}

export default function RouteMap({
  points, result, venues, activeVenueIds, selected, onSelect, onAdd, drawing, fitToken, roads = [], tallBuildings = [], liveChip = [],
}: {
  points: LatLon[]; result: RouteResult | null; venues: Venue[]; activeVenueIds: string[];
  selected: number | null; onSelect: (i: number) => void; onAdd: (p: LatLon) => void; drawing: boolean; fitToken: number;
  roads?: Road[]; tallBuildings?: LatLon[]; liveChip?: string[];
}) {
  return (
    <div className="relative h-full w-full">
    <MapContainer
      center={[51.5074, -0.1278]}
      zoom={12}
      className={`h-full w-full ${drawing ? "cursor-crosshair" : ""}`}
      scrollWheelZoom
      keyboard
      attributionControl
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="wm-dark-tiles"
        maxZoom={19}
      />
      <ClickToAdd onAdd={onAdd} enabled={drawing} />
      <SizeWatcher />
      <FitTo points={points} token={fitToken} />
      <AirspaceLayer points={points} />

      {roads.map((r) => (
        <Polyline key={`road-${r.id}`} positions={r.line} pathOptions={{ color: "#8FA8FF", weight: 3, opacity: 0.75 }}>
          <Tooltip className="wm-tip" sticky>{r.name} ({r.kind}) · live from OpenStreetMap · in-car jammers are most common on major roads</Tooltip>
        </Polyline>
      ))}
      {tallBuildings.map((b, i) => (
        <CircleMarker key={`bld-${i}`} center={b} radius={3} pathOptions={{ color: "#D9DCE3", weight: 1, fillColor: "#D9DCE3", fillOpacity: 0.8 }}>
          <Tooltip className="wm-tip" direction="top">Building of 10+ floors · live from OpenStreetMap</Tooltip>
        </CircleMarker>
      ))}

      {venues.map((v) => {
        const on = activeVenueIds.includes(v.id);
        return (
          <CircleMarker key={v.id} center={[v.lat, v.lon]} radius={on ? 7 : 4}
            pathOptions={{ color: on ? "#E0A84A" : "#868D98", weight: on ? 2 : 1, fillColor: on ? "#E0A84A" : "#868D98", fillOpacity: on ? 0.35 : 0.25 }}>
            <Tooltip className="wm-tip" direction="top">{v.name}{on ? " · event during flight" : ""}</Tooltip>
          </CircleMarker>
        );
      })}

      {result
        ? result.sections.map((s) => (
            <Polyline
              key={s.index}
              positions={[s.start, s.end]}
              eventHandlers={{ click: () => onSelect(s.index) }}
              pathOptions={{
                color: COLORS[s.decision],
                weight: selected === s.index ? 9 : 6,
                opacity: selected === null || selected === s.index ? 1 : 0.55,
                dashArray: s.confidence === "Low" ? "10 7" : undefined,
                lineCap: "round",
              }}
            >
              <Tooltip className="wm-tip" sticky>Section {s.index + 1}: {LABEL[s.decision]} · {s.confidence} confidence</Tooltip>
            </Polyline>
          ))
        : points.length >= 2 && <Polyline positions={points} pathOptions={{ color: "#8FA8C8", weight: 4, dashArray: "6 6" }} />}

      {points.map((p, i) => (
        <CircleMarker key={`${i}-${p[0]}-${p[1]}`} center={p} radius={i === 0 || i === points.length - 1 ? 6 : 4}
          pathOptions={{ color: "#0A0B0D", weight: 2, fillColor: "#EDEEF0", fillOpacity: 1 }}>
          <Tooltip className="wm-tip" direction="top">{i === 0 ? "Start" : i === points.length - 1 ? "End" : `Waypoint ${i + 1}`}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
    {liveChip.length > 0 && (
      <div className="pointer-events-none absolute right-3 top-16 z-[500] max-w-[calc(100%-1.5rem)] sm:top-3 sm:max-w-[60%] rounded-lg border bg-background/90 px-3 py-1.5 text-xs backdrop-blur">
        <span className="mr-2 inline-flex items-center gap-1 font-medium text-good"><span className="h-1.5 w-1.5 rounded-full bg-good" />LIVE</span>
        <span className="text-muted-foreground">{liveChip.join(" · ")}</span>
      </div>
    )}
    </div>
  );
}
