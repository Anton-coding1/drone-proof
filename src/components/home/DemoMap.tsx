import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, useMap } from "react-leaflet";
import type { RouteResult } from "@/lib/routeRisk";
import { DEMO_ROUTE, DEMO_WEMBLEY } from "@/components/home/demoData";

const COLORS = { go: "#4FB286", caution: "#E0A84A", nogo: "#E5574F" } as const;
const LABEL = { go: "GO", caution: "CAUTION", nogo: "NO-GO" } as const;

const BOUNDS: [number, number][] = [...DEMO_ROUTE, [DEMO_WEMBLEY.lat, DEMO_WEMBLEY.lon]];

function Fit() {
  const map = useMap();
  useEffect(() => {
    const fit = () => { map.invalidateSize(); map.fitBounds(BOUNDS, { padding: [60, 60], maxZoom: 15, animate: false }); };
    fit();
    const ro = new ResizeObserver(() => { map.invalidateSize(); fit(); });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** A real (static) map of the illustrative route. Panning is off so it never traps page scroll. */
export default function DemoMap({ result, eventActive }: { result: RouteResult; eventActive: boolean }) {
  const start = DEMO_ROUTE[0]!, end = DEMO_ROUTE[DEMO_ROUTE.length - 1]!;
  return (
    <MapContainer
      bounds={BOUNDS}
      boundsOptions={{ padding: [60, 60] }}
      className="h-full w-full"
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="wm-dark-tiles"
        maxZoom={19}
      />
      <Fit />

      {eventActive && (
        <>
          <Circle center={[DEMO_WEMBLEY.lat, DEMO_WEMBLEY.lon]} radius={2000} pathOptions={{ color: "#E0A84A", weight: 1, opacity: 0.7, fillColor: "#E0A84A", fillOpacity: 0.08, dashArray: "4 6" }} />
        </>
      )}
      <CircleMarker center={[DEMO_WEMBLEY.lat, DEMO_WEMBLEY.lon]} radius={eventActive ? 7 : 5}
        pathOptions={{ color: eventActive ? "#E0A84A" : "#A9AEB5", weight: 2, fillColor: eventActive ? "#E0A84A" : "#A9AEB5", fillOpacity: 0.5 }}>
        <Tooltip permanent direction="left" offset={[-10, 0]} className="wm-tip wm-label">{eventActive ? "Wembley Stadium · match on" : "Wembley Stadium"}</Tooltip>
      </CircleMarker>

      {/* casing under the route so the colours read on any tile */}
      <Polyline positions={DEMO_ROUTE} pathOptions={{ color: "#08090A", weight: 11, opacity: 0.85, lineCap: "round", lineJoin: "round" }} interactive={false} />
      {result.sections.map((s) => (
        <Polyline
          key={s.index}
          positions={[s.start, s.end]}
          pathOptions={{ color: COLORS[s.decision], weight: 6, lineCap: "round", dashArray: s.confidence === "Low" ? "10 8" : undefined }}
        >
          <Tooltip className="wm-tip" sticky>Section {s.index + 1} of {result.sections.length}: {LABEL[s.decision]} · {s.lengthKm.toFixed(1)} km</Tooltip>
        </Polyline>
      ))}

      <CircleMarker center={start} radius={6} pathOptions={{ color: "#08090A", weight: 2, fillColor: "#F2F2EF", fillOpacity: 1 }}>
        <Tooltip permanent direction="bottom" offset={[0, 8]} className="wm-tip wm-label">Take-off</Tooltip>
      </CircleMarker>
      <CircleMarker center={end} radius={6} pathOptions={{ color: "#08090A", weight: 2, fillColor: "#F2F2EF", fillOpacity: 1 }}>
        <Tooltip permanent direction="top" offset={[0, -8]} className="wm-tip wm-label">Hospital</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
