#!/usr/bin/env python3
"""Builds src/lib/airspaceData.ts: UK aerodrome flight restriction zones (FRZs) for the pre-flight check.

Which aerodromes are protected (ANO 2016 art. 94A(6)):
  - CAA certificated aerodromes        (caa.co.uk "UK certificated aerodromes", checked Oct 2026)
  - CAA national licensed aerodromes   (caa.co.uk "Aerodrome licences", checked Oct 2026)
  - Government (military) aerodromes   (active RAF / RNAS / Army / MoD airfields)
Every other UK airfield with an ICAO code is listed as an "airfield" (not known to be protected): the check
asks the pilot to confirm, rather than stopping the flight.

Geometry follows art. 94A/94B: the ATZ (2 NM radius, 2.5 NM if the longest runway is over 1,850 m, centred on
the longest runway's mid-point), a runway protection zone at every threshold (5 km long, 1 km wide; 1.5 km at
Heathrow), and a 1 km boundary zone (approximated here as 1 km around each runway). Aerodromes without runway
coordinates get a 2 NM circle on the aerodrome reference point.

Runway coordinates: OurAirports (public domain), https://github.com/davidmegginson/ourairports-data
Usage:  python make_airspace.py airports.csv runways.csv
"""
import csv, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "lib", "airspaceData.ts")

CERTIFICATED = ("EGPD EGAC EGAA EGPL EGBB EGHH EGGD EGSC EGEC EGFF EGPN EGNX EGPH EGTE EGPF EGNR EGNJ EGPE EGPI EGPA "
                "EGNM EGGP EGLC EGKK EGLL EGSS EGAE EGGW EGCC EGNT EGHQ EGSH EGTK EGPK EGHI EGMC EGPO EGPB EGNV EGPU EGPC").split()
# CAA licensed list (name on the CAA page -> OurAirports ident). Penzance heliport has no ICAO entry in OurAirports.
LICENSED = {"EGPR": "Barra", "EGKB": "Biggin Hill", "EGLK": "Blackbushe", "EGLJ": "Chalgrove", "EGEL": "Coll", "EGEY": "Colonsay",
            "EGTC": "Cranfield", "EGED": "Eday", "EGAB": "Enniskillen", "EGEF": "Fair Isle", "EGTF": "Fairoaks", "EGLF": "Farnborough",
            "EGBJ": "Gloucestershire", "EGFE": "Haverfordwest", "EGBP": "Kemble (Cotswold)", "EGHC": "Land's End", "EGXG": "Leeds East",
            "EGLW": "London Heliport", "EGMD": "Lydd", "EGEN": "North Ronaldsay", "EGEO": "Oban", "EGEP": "Papa Westray",
            "GB-1327": "Penzance Heliport", "EGDP": "Portland", "EGNE": "Retford (Gamston)", "EGES": "Sanday", "EGDX": "St Athan",
            "EGHE": "St Mary's (Scilly)", "EGER": "Stronsay", "EGET": "Tingwall", "EGHT": "Tresco", "EGNL": "Walney",
            "EGNO": "Warton", "EGFA": "West Wales (Aberporth)", "EGEW": "Westray", "EGBO": "Wolverhampton Halfpenny Green", "EGHG": "Yeovil"}
GOV_EXTRA = {"EGOV": "RAF Valley", "EGUW": "Wattisham", "EGVP": "Middle Wallop", "EGQL": "Leuchars"}
GOV_RE = re.compile(r"\b(RAF|RNAS|MoD|MOD)\b")
NAME_FIX = {"EGLL": "Heathrow", "EGKK": "Gatwick", "EGSS": "Stansted", "EGGW": "Luton", "EGLC": "London City", "EGMC": "Southend",
            "EGQL": "Leuchars", "EGXG": "Leeds East"}

NM = 1.852


def main(airports_csv, runways_csv):
    ap = {r["ident"]: r for r in csv.DictReader(open(airports_csv, encoding="utf-8")) if r["iso_country"] == "GB" and r["type"] != "closed"}
    rws = {}
    for r in csv.DictReader(open(runways_csv, encoding="utf-8")):
        if r["airport_ident"] in ap and r["closed"] == "0" and r["le_latitude_deg"] and r["he_latitude_deg"] and not r["le_ident"].upper().startswith("H"):
            rws.setdefault(r["airport_ident"], []).append(r)

    protected = {}
    for i in CERTIFICATED: protected[i] = "certificated"
    for i in LICENSED: protected.setdefault(i, "licensed")
    for i, a in ap.items():
        if GOV_RE.search(a["name"]) and a["type"] in ("medium_airport", "large_airport") and i in rws: protected.setdefault(i, "government")
    for i in GOV_EXTRA: protected.setdefault(i, "government")
    # Small military sites with runway data (gliding / relief strips without runway data are left as airfields).
    for i, a in ap.items():
        if GOV_RE.search(a["name"]) and a["type"] == "small_airport" and i in rws: protected.setdefault(i, "government")

    def name(i):
        if i in NAME_FIX: return NAME_FIX[i]
        if i in GOV_EXTRA: return GOV_EXTRA[i]
        if i in LICENSED: return LICENSED[i]
        n = ap[i]["name"]
        return re.sub(r"\s+(International\s+)?(Airport|Aerodrome|Airfield|Airstrip)$", "", n).strip()

    aero = []
    missing = []
    for i, kind in sorted(protected.items()):
        if i not in ap: missing.append(i); continue
        a = ap[i]
        runways = []
        longest = None
        for r in rws.get(i, []):
            la1, lo1, la2, lo2 = (float(r[k]) for k in ("le_latitude_deg", "le_longitude_deg", "he_latitude_deg", "he_longitude_deg"))
            # Move each end inwards by its displaced threshold, if any, so the RPZ starts at the threshold.
            L = math.hypot((la2 - la1) * 110.574, (lo2 - lo1) * 111.320 * math.cos(math.radians(la1)))
            if L < 0.1: continue
            d1 = float(r["le_displaced_threshold_ft"] or 0) * 0.0003048 / L
            d2 = float(r["he_displaced_threshold_ft"] or 0) * 0.0003048 / L
            t1 = (la1 + (la2 - la1) * d1, lo1 + (lo2 - lo1) * d1)
            t2 = (la2 + (la1 - la2) * d2, lo2 + (lo1 - lo2) * d2)
            runways.append([round(t1[0], 5), round(t1[1], 5), round(t2[0], 5), round(t2[1], 5), r["le_ident"], r["he_ident"]])
            if longest is None or L > longest[0]: longest = (L, (la1 + la2) / 2, (lo1 + lo2) / 2)
        heli = a["type"] == "heliport" or not runways
        if longest:
            atz = 2.5 if longest[0] > 1.85 else 2.0
            c = (round(longest[1], 5), round(longest[2], 5))
        else:
            atz, c = 2.0, (round(float(a["latitude_deg"]), 5), round(float(a["longitude_deg"]), 5))
        aero.append({"id": "EGHK" if i == "GB-1327" else i, "name": name(i), "kind": kind, "c": c, "atzNm": atz,
                     "rpzW": 1.5 if i == "EGLL" else 1.0, "runways": [] if heli and not longest else runways})

    others = []
    for i, a in sorted(ap.items()):
        if i in protected or a["type"] not in ("small_airport", "medium_airport", "large_airport"): continue
        if not (len(i) == 4 and i.startswith("EG")): continue
        others.append([i, name(i), round(float(a["latitude_deg"]), 4), round(float(a["longitude_deg"]), 4)])

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// GENERATED by data-engine/make_airspace.py — do not edit by hand.\n")
        f.write("// Protected status: CAA certificated + licensed lists (Oct 2026) and active military airfields.\n")
        f.write("// Runway coordinates: OurAirports (public domain). Geometry: ANO 2016 articles 94A and 94B.\n\n")
        f.write('export type AerodromeKind = "certificated" | "licensed" | "government";\n')
        f.write("/** Runway thresholds: [lat1, lon1, lat2, lon2, ident1, ident2]. */\n")
        f.write("export type Aerodrome = { id: string; name: string; kind: AerodromeKind; c: [number, number]; atzNm: number; rpzW: number; runways: [number, number, number, number, string, string][] };\n\n")
        f.write("export const PROTECTED_AERODROMES: Aerodrome[] = [\n")
        for x in aero: f.write("  " + json.dumps(x, ensure_ascii=False, separators=(",", ":")) + ",\n")
        f.write("];\n\n/** Other UK airfields with an ICAO code: [id, name, lat, lon]. Not known to be protected. */\n")
        f.write("export const OTHER_AIRFIELDS: [string, string, number, number][] = [\n")
        for x in others: f.write("  " + json.dumps(x, ensure_ascii=False, separators=(",", ":")) + ",\n")
        f.write("];\n")
    print(f"{len(aero)} protected aerodromes, {len(others)} other airfields → {os.path.abspath(OUT)}")
    if missing: print("not found:", missing)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
