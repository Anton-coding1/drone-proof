import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { LatLon, RouteResult, Venue } from "@/lib/routeRisk";

const COLORS = { go: "#4FB286", caution: "#E0A84A", nogo: "#E5574F" } as const;
const LABEL = { go: "GO", caution: "CAUTION", nogo: "NO-GO" } as const;

function ClickToAdd({ onAdd, enabled }: { onAdd: (p: LatLon) => void; enabled: boolean }) {
  useMapEvents({ click: (e) => { if (enabled) onAdd([+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)]); } });
  return null;
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
  points, result, venues, activeVenueIds, selected, onSelect, onAdd, drawing, fitToken,
}: {
  points: LatLon[]; result: RouteResult | null; venues: Venue[]; activeVenueIds: string[];
  selected: number | null; onSelect: (i: number) => void; onAdd: (p: LatLon) => void; drawing: boolean; fitToken: number;
}) {
  return (
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
      <FitTo points={points} token={fitToken} />

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
  );
}
