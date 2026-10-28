import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Tooltip } from "react-leaflet";

export type Pt = { lat: number; lon: number; accuracy_m: number | null };

const GOOD = "#4FB286", WARN = "#E0A84A", BAD = "#E5574F", NA = "#8B919B";
function color(a: number | null) {
  if (a === null) return NA;
  if (a < 3) return GOOD;
  if (a <= 10) return WARN;
  return BAD;
}

/** Flight track coloured by GPS accuracy, on a dark basemap. */
export default function FlightMap({ points, events, firedIndex }: { points: Pt[]; events: { lat: number; lon: number }[]; firedIndex?: number | null }) {
  if (!points.length) return null;
  const bounds = points.map((p) => [p.lat, p.lon] as [number, number]);
  // Merge consecutive points of the same colour into one polyline (fast even for 20k points).
  const runs: { color: string; pts: [number, number][] }[] = [];
  for (let i = 1; i < points.length; i++) {
    const c = color(points[i]!.accuracy_m);
    const seg: [number, number] = [points[i]!.lat, points[i]!.lon];
    const last = runs[runs.length - 1];
    if (last && last.color === c) last.pts.push(seg);
    else runs.push({ color: c, pts: [[points[i - 1]!.lat, points[i - 1]!.lon], seg] });
  }
  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [36, 36] }} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="wm-dark-tiles"
        maxZoom={19}
      />
      {events.map((e, i) => (
        <Circle key={i} center={[e.lat, e.lon]} radius={8000} pathOptions={{ color: BAD, weight: 1.5, fillOpacity: 0.06, dashArray: "6 6" }}>
          <Tooltip className="wm-tip" sticky>Reported interference event (aircraft data)</Tooltip>
        </Circle>
      ))}
      {runs.map((r, i) => (
        <Polyline key={i} positions={r.pts} pathOptions={{ color: r.color, weight: 4, lineCap: "round", lineJoin: "round" }} />
      ))}
      <CircleMarker center={bounds[0]!} radius={5} pathOptions={{ color: "#0A0B0D", weight: 2, fillColor: "#EDEEF0", fillOpacity: 1 }}>
        <Tooltip className="wm-tip" direction="top">Take-off</Tooltip>
      </CircleMarker>
      {firedIndex != null && points[firedIndex] && (
        <CircleMarker center={[points[firedIndex]!.lat, points[firedIndex]!.lon]} radius={8}
          pathOptions={{ color: "#EDEEF0", weight: 2.5, fillColor: BAD, fillOpacity: 1 }}>
          <Tooltip className="wm-tip" permanent direction="top" offset={[0, -8]}>Evidence first fired</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
