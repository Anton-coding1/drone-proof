"""Local SQLite storage. The database stays on the sensor; nothing here is uploaded."""
from __future__ import annotations

import json
import sqlite3
from typing import Iterable

from .model import Epoch, Event

SCHEMA = """
CREATE TABLE IF NOT EXISTS epochs (
  t REAL NOT NULL, site TEXT NOT NULL, fix INTEGER, num_sv INTEGER, h_acc_m REAL, cno_top REAL,
  sats_tracked INTEGER, agc REAL, jam_ind REAL, jam_state INTEGER, spoof_state INTEGER, lat REAL, lon REAL,
  PRIMARY KEY (site, t)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, site TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL,
  confidence TEXT NOT NULL, evidence TEXT NOT NULL, peak_cno_drop_db REAL, peak_agc_shift REAL,
  peak_jam_ind_rise REAL, max_offset_m REAL, closed_by_gap INTEGER, simulated INTEGER NOT NULL DEFAULT 0,
  UNIQUE (site, kind, start)
);
"""


def connect(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    db.execute("PRAGMA journal_mode=WAL")
    return db


def save_epochs(db: sqlite3.Connection, site: str, epochs: Iterable[Epoch]) -> int:
    rows = [(e.t, site, e.fix, e.num_sv, e.h_acc_m, e.cno_top, e.sats_tracked, e.agc, e.jam_ind,
             e.jam_state, e.spoof_state, e.lat, e.lon) for e in epochs]
    db.executemany("INSERT OR IGNORE INTO epochs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    db.commit()
    return len(rows)


def save_event(db: sqlite3.Connection, site: str, ev: Event, simulated: bool = False) -> None:
    db.execute(
        "INSERT OR REPLACE INTO events (site, kind, start, end, confidence, evidence, peak_cno_drop_db, peak_agc_shift,"
        " peak_jam_ind_rise, max_offset_m, closed_by_gap, simulated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (site, ev.kind, ev.start, ev.end, ev.confidence, json.dumps(ev.evidence), ev.peak_cno_drop_db,
         ev.peak_agc_shift, ev.peak_jam_ind_rise, ev.max_offset_m, int(ev.closed_by_gap), int(simulated)),
    )
    db.commit()


def load_epochs(db: sqlite3.Connection, site: str, since: float = 0) -> Iterable[Epoch]:
    cur = db.execute("SELECT t, fix, num_sv, h_acc_m, cno_top, sats_tracked, agc, jam_ind, jam_state, spoof_state, lat, lon"
                     " FROM epochs WHERE site=? AND t>=? ORDER BY t", (site, since))
    for r in cur:
        yield Epoch(*r)


def prune(db: sqlite3.Connection, keep_days: int, now: float) -> int:
    """Delete second-by-second data older than keep_days. Events are always kept."""
    n = db.execute("DELETE FROM epochs WHERE t < ?", (now - keep_days * 86400,)).rowcount
    db.commit()
    return n
