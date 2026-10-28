#!/usr/bin/env python3
"""Witnessmark ground sensor - command line.

  python witnessmark_sensor.py run --port /dev/ttyACM0 --site site-01
  python witnessmark_sensor.py replay recording.ubx --site site-01
  python witnessmark_sensor.py simulate --scenario jamming        (synthetic data, for testing)
  python witnessmark_sensor.py report --site site-01 --days 7
  python witnessmark_sensor.py export --site site-01 --out events.csv

RECEIVE-ONLY. This program listens to satellite signals and logs the receiver's own
health reports. It never transmits. Never build, buy or test a jammer: it is illegal in
the UK and endangers aircraft and emergency services.

PRIVACY. The database stores the antenna's position so the detector can notice a static
antenna "moving" (spoofing). It stays on this device. Exports and reports never include
coordinates - only the site name you choose, so pick one that doesn't identify the address.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import os
import signal
import sys
import time

from sensor import __version__
from sensor import detector, store
from sensor.model import Epoch

DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sensor.db")


def utc(t: float) -> str:
    return dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _check_site(site: str) -> str:
    if not site.replace("-", "").replace("_", "").isalnum() or len(site) > 40:
        sys.exit("Site name: letters, numbers, - and _ only (e.g. site-01). Don't use your address.")
    return site


def process(db, site: str, epochs, simulated: bool = False, quiet: bool = False) -> int:
    det = detector.Detector()
    batch: list[Epoch] = []
    n_events = 0

    def emit(evs):
        nonlocal n_events
        for ev in evs:
            store.save_event(db, site, ev, simulated)
            n_events += 1
            if not quiet:
                print(f"[{utc(ev.start)}] {ev.kind.upper()} for {ev.duration_s:.0f} s, {ev.confidence} confidence")
                for line in detector.describe(ev):
                    print(f"    - {line}")

    last_flush = time.monotonic()
    for e in epochs:
        batch.append(e)
        emit(det.feed(e))
        if len(batch) >= 300 or time.monotonic() - last_flush > 30:
            store.save_epochs(db, site, batch)
            batch, last_flush = [], time.monotonic()
    store.save_epochs(db, site, batch)
    emit(det.flush())
    return n_events


def cmd_run(a):
    import serial  # pyserial
    from sensor.ubx import configure, epochs_from_stream

    site = _check_site(a.site)
    db = store.connect(a.db)
    print(f"Witnessmark sensor {__version__} - site '{site}' - logging to {a.db}. Ctrl+C to stop.")
    stop = {"now": False}
    signal.signal(signal.SIGTERM, lambda *_: stop.update(now=True))
    while not stop["now"]:
        try:
            with serial.Serial(a.port, a.baud, timeout=3) as port:
                configure(port)
                process(db, site, epochs_from_stream(port))
        except KeyboardInterrupt:
            break
        except Exception as exc:  # unplugged, permission, etc. - keep trying
            print(f"Receiver not available ({exc.__class__.__name__}: {exc}). Retrying in 10 s.", file=sys.stderr)
            time.sleep(10)
    print("Stopped.")


def cmd_replay(a):
    from sensor.ubx import epochs_from_stream

    db = store.connect(a.db)
    with open(a.file, "rb") as f:
        n = process(db, _check_site(a.site), epochs_from_stream(f))
    print(f"Replay finished: {n} event(s).")


def cmd_simulate(a):
    from sensor import sim

    t0 = 1_790_000_000.0  # a fixed date so runs are repeatable
    hours = a.hours
    base = sim.quiet(t0, int(hours * 3600), seed=a.seed)
    mid = t0 + hours * 3600 * 0.6
    if a.scenario == "jamming":
        base = sim.with_jamming(base, mid, mid + 600, strength_db=12)
    elif a.scenario == "strong-jamming":
        base = sim.with_jamming(base, mid, mid + 300, strength_db=30)
    elif a.scenario == "spoofing":
        base = sim.with_spoofing(base, mid, mid + 600)
    elif a.scenario == "two-events":
        base = sim.with_spoofing(sim.with_jamming(base, mid - 600, mid - 300, strength_db=10), mid + 600, mid + 900)
    elif a.scenario == "blockage":
        base = sim.with_blockage(base, mid, mid + 900)
    if a.csv:
        write_sensor_csv(a.csv, base)
        print(f"SIMULATED DATA ({a.scenario}) written to {a.csv} - not a real measurement.")
        return
    db = store.connect(a.db)
    print(f"SIMULATED DATA ({a.scenario}) - not a real measurement.")
    n = process(db, "simulated", base, simulated=True)
    print(f"Simulation finished: {n} event(s) detected.")


def write_sensor_csv(path, epochs):
    """One row per second in the format the website's site-monitoring demo reads."""
    def fmt(v, nd):
        return "" if v is None else (f"{v:.{nd}f}" if nd else str(int(round(v))))
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "fix", "num_sv", "h_acc_m", "cno_top", "sats_tracked", "agc", "jam_ind", "jam_state", "spoof_state", "lat", "lon"])
        for e in epochs:
            w.writerow([dt.datetime.fromtimestamp(e.t, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), e.fix, e.num_sv,
                        fmt(e.h_acc_m, 2), fmt(e.cno_top, 2), e.sats_tracked, fmt(e.agc, 0), fmt(e.jam_ind, 0),
                        e.jam_state, e.spoof_state, fmt(e.lat, 7), fmt(e.lon, 7)])


def cmd_report(a):
    db = store.connect(a.db)
    since = time.time() - a.days * 86400
    site = _check_site(a.site)
    row = db.execute("SELECT COUNT(*), MIN(t), MAX(t), AVG(cno_top), SUM(fix>=3) FROM epochs WHERE site=? AND t>=?", (site, since)).fetchone()
    n, t_min, t_max, cno, fixed = row
    print(f"Site '{site}', last {a.days} day(s)")
    if not n:
        print("  No data yet.")
        return
    span = (t_max - t_min) or 1
    print(f"  Logged {n:,} seconds between {utc(t_min)} and {utc(t_max)} ({100 * n / span:.0f}% coverage)")
    print(f"  Average strength of strongest satellites: {cno:.1f} dB-Hz; 3D fix {100 * fixed / n:.0f}% of the time")
    evs = db.execute("SELECT kind, start, end, confidence FROM events WHERE site=? AND start>=? ORDER BY start", (site, since)).fetchall()
    print(f"  Events: {len(evs)}")
    for kind, s, e, conf in evs:
        print(f"    {utc(s)}  {kind:<9} {e - s:>6.0f} s  {conf}")


def cmd_export(a):
    """Events only, no coordinates - safe to share with partners or import elsewhere."""
    db = store.connect(a.db)
    rows = db.execute("SELECT site, kind, start, end, confidence, evidence, peak_cno_drop_db, peak_agc_shift, peak_jam_ind_rise,"
                      " max_offset_m, simulated FROM events WHERE site=? ORDER BY start", (_check_site(a.site),)).fetchall()
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["site", "type", "start_time", "end_time", "duration_s", "confidence", "evidence", "peak_cno_drop_db",
                    "peak_agc_shift", "peak_jam_ind_rise", "max_apparent_move_m", "simulated"])
        for site, kind, s, e, conf, evid, cd, ag, ji, off, simd in rows:
            w.writerow([site, kind, utc(s), utc(e), round(e - s), conf, evid.replace(",", ";"), round(cd or 0, 1),
                        round(ag or 0, 3), round(ji or 0), round(off or 0), bool(simd)])
    print(f"Wrote {len(rows)} event(s) to {a.out} (no coordinates included).")


def cmd_prune(a):
    db = store.connect(a.db)
    n = store.prune(db, a.keep_days, time.time())
    print(f"Deleted {n:,} second-by-second rows older than {a.keep_days} days. Events kept.")


def main(argv=None):
    p = argparse.ArgumentParser(description="Witnessmark receive-only GNSS interference sensor")
    p.add_argument("--db", default=DEFAULT_DB, help="SQLite file (default: sensor.db next to this script)")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="log from a connected u-blox receiver")
    r.add_argument("--port", default="/dev/ttyACM0"); r.add_argument("--baud", type=int, default=38400)
    r.add_argument("--site", required=True); r.set_defaults(fn=cmd_run)
    r = sub.add_parser("replay", help="process a recorded .ubx file"); r.add_argument("file")
    r.add_argument("--site", required=True); r.set_defaults(fn=cmd_replay)
    r = sub.add_parser("simulate", help="run the detector on synthetic data")
    r.add_argument("--scenario", choices=["quiet", "jamming", "strong-jamming", "spoofing", "two-events", "blockage"], default="jamming")
    r.add_argument("--hours", type=float, default=2.0); r.add_argument("--seed", type=int, default=1)
    r.add_argument("--csv", help="write the simulated readings to this CSV instead of running the detector"); r.set_defaults(fn=cmd_simulate)
    r = sub.add_parser("report", help="summary of logged data"); r.add_argument("--site", required=True)
    r.add_argument("--days", type=float, default=7); r.set_defaults(fn=cmd_report)
    r = sub.add_parser("export", help="events as CSV, without coordinates"); r.add_argument("--site", required=True)
    r.add_argument("--out", default="sensor_events.csv"); r.set_defaults(fn=cmd_export)
    r = sub.add_parser("prune", help="delete old second-by-second data"); r.add_argument("--keep-days", type=int, default=90)
    r.set_defaults(fn=cmd_prune)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
