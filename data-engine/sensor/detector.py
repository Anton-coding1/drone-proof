"""Interference detector for a static GNSS antenna.

Idea: learn what "normal" looks like at this site, then flag moments when several
independent signs of interference appear together and persist.

Signs of jamming (extra noise in the GNSS band):
  * the strongest satellites all get weaker at once (C/N0 drop) - an obstruction
    only blocks some satellites, jamming hits every one;
  * the front end's automatic gain control (AGC) moves away from its usual level;
  * the receiver's own jamming indicator rises, or it raises its jamming flag;
  * the fix is lost while signals were fine a moment ago.

Signs of spoofing (fake satellite signals):
  * a static antenna suddenly "moves" while claiming good accuracy;
  * the receiver raises its spoofing flag;
  * signals get *stronger* than usual at the same time.

All thresholds are provisional and should be tuned on real data from each site.
"""
from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from statistics import median
from typing import Iterable, Iterator, Optional

from .model import Epoch, Event


@dataclass
class Settings:
    warmup_minutes: int = 30          # baseline needed before signal-based detection starts
    baseline_minutes: int = 360       # rolling window of clean minutes used as "normal"
    min_on_s: int = 5                 # seconds of evidence before an event opens
    min_off_s: int = 30               # quiet seconds before an event closes
    gap_s: int = 10                   # a data gap longer than this closes any open event
    cno_drop_db: float = 4.0          # minimum drop of the strongest satellites, dB-Hz
    cno_rise_db: float = 4.0          # minimum rise (spoofing sign), dB-Hz
    agc_shift: float = 0.15           # minimum relative AGC change
    jam_ind_rise: float = 15.0        # minimum rise of the jamming indicator
    offset_m: float = 30.0            # apparent movement of a static antenna that counts
    offset_strong_m: float = 100.0    # movement that counts on its own
    good_hacc_m: float = 5.0          # receiver must claim at least this accuracy for offsets to count


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _mad(xs: list[float], centre: float) -> float:
    return 1.4826 * median(abs(x - centre) for x in xs) if xs else 0.0


class Baseline:
    """Rolling per-minute medians of clean data."""

    def __init__(self, s: Settings):
        self.s = s
        self.minutes: deque[tuple[float, float, float]] = deque(maxlen=s.baseline_minutes)
        self._bucket: list[Epoch] = []
        self._bucket_minute: Optional[int] = None
        self.ref_lat: Optional[float] = None
        self.ref_lon: Optional[float] = None
        self._pos: list[tuple[float, float]] = []

    def add_clean(self, e: Epoch) -> None:
        m = int(e.t // 60)
        if self._bucket_minute is not None and m != self._bucket_minute:
            self._flush()
        self._bucket_minute = m
        self._bucket.append(e)
        # Reference position: median of the first 30 minutes of good fixes.
        if self.ref_lat is None and e.fix >= 3 and e.lat is not None and e.h_acc_m is not None and e.h_acc_m <= self.s.good_hacc_m:
            self._pos.append((e.lat, e.lon))  # type: ignore[arg-type]
            if len(self._pos) >= 1800:
                self.ref_lat = median(p[0] for p in self._pos)
                self.ref_lon = median(p[1] for p in self._pos)
                self._pos = []

    def _flush(self) -> None:
        b = self._bucket
        cno = [x.cno_top for x in b if x.cno_top is not None]
        agc = [x.agc for x in b if x.agc is not None]
        ji = [x.jam_ind for x in b if x.jam_ind is not None]
        if cno:
            self.minutes.append((median(cno), median(agc) if agc else math.nan, median(ji) if ji else math.nan))
        self._bucket = []

    @property
    def ready(self) -> bool:
        return len(self.minutes) >= self.s.warmup_minutes

    def stats(self) -> dict[str, tuple[float, float]]:
        out: dict[str, tuple[float, float]] = {}
        for i, name in enumerate(("cno", "agc", "jam")):
            xs = [m[i] for m in self.minutes if not math.isnan(m[i])]
            if xs:
                c = median(xs)
                out[name] = (c, _mad(xs, c))
        return out


@dataclass
class Signals:
    jam_score: int
    spoof_score: int
    evidence: list[str]
    cno_drop: float
    agc_shift: float
    jam_rise: float
    offset_m: float


class Detector:
    """Feed epochs in time order; completed events come out."""

    def __init__(self, settings: Optional[Settings] = None):
        self.s = settings or Settings()
        self.base = Baseline(self.s)
        self.open: Optional[Event] = None
        self._on = 0
        self._off = 0
        self._pending: list[tuple[Epoch, Signals]] = []
        self._last_t: Optional[float] = None

    # ---- per-epoch evidence -------------------------------------------------
    def signals(self, e: Epoch) -> Signals:
        s, ev = self.s, []
        jam = spoof = 0
        cno_drop = agc_shift = jam_rise = offset = 0.0
        st = self.base.stats() if self.base.ready else {}

        if "cno" in st and e.cno_top is not None:
            c, spread = st["cno"]
            cno_drop = c - e.cno_top
            if cno_drop >= max(s.cno_drop_db, 4 * max(spread, 0.75)):
                jam += 2; ev.append("cno_drop")
            elif -cno_drop >= max(s.cno_rise_db, 4 * max(spread, 0.75)):
                spoof += 1; ev.append("cno_rise")
        if "cno" in st and e.cno_top is None and e.sats_tracked == 0:
            jam += 2; ev.append("no_sats")
        if "agc" in st and e.agc is not None and st["agc"][0] > 0:
            c, spread = st["agc"]
            agc_shift = abs(e.agc - c) / c
            if agc_shift >= max(s.agc_shift, 5 * spread / c):
                jam += 1; ev.append("agc")
        if "jam" in st and e.jam_ind is not None:
            c, spread = st["jam"]
            jam_rise = e.jam_ind - c
            if jam_rise >= max(s.jam_ind_rise, 5 * max(spread, 1.0)):
                jam += 1; ev.append("jam_ind")
        if e.jam_state >= 2:
            jam += 2; ev.append("rx_jam")
        if self.base.ready and e.fix < 2 and jam >= 1:
            jam += 1; ev.append("fix_lost")

        if e.spoof_state >= 2:
            spoof += 2; ev.append("rx_spoof")
        if (self.base.ref_lat is not None and e.lat is not None and e.fix >= 3
                and e.h_acc_m is not None and e.h_acc_m <= s.good_hacc_m):
            offset = _haversine_m(self.base.ref_lat, self.base.ref_lon, e.lat, e.lon)  # type: ignore[arg-type]
            if offset >= max(s.offset_strong_m, 10 * e.h_acc_m):
                spoof += 3; ev.append("offset")
            elif offset >= max(s.offset_m, 5 * e.h_acc_m):
                spoof += 2; ev.append("offset")
        return Signals(jam, spoof, ev, cno_drop, agc_shift, jam_rise, offset)

    # ---- event state machine -------------------------------------------------
    def feed(self, e: Epoch) -> list[Event]:
        done: list[Event] = []
        if self._last_t is not None and e.t - self._last_t > self.s.gap_s:
            done += self._close(gap=True)
            self._pending, self._on = [], 0
        self._last_t = e.t

        sig = self.signals(e)
        kind = "spoofing" if sig.spoof_score >= 3 else "jamming" if sig.jam_score >= 3 else None

        if self.open is None:
            if kind:
                self._on += 1
                self._pending.append((e, sig))
                if self._on >= self.s.min_on_s:
                    first = self._pending[0][0]
                    self.open = Event(kind=kind, start=first.t, end=e.t, confidence="Low")
                    for pe, ps in self._pending:
                        self._absorb(pe, ps)
                    self._pending, self._off = [], 0
            else:
                for pe, _ in self._pending:
                    self.base.add_clean(pe)
                self._pending, self._on = [], 0
                self.base.add_clean(e)
        else:
            if kind:
                self._off = 0
                if kind == "spoofing" and self.open.kind == "jamming":
                    self.open.kind = "spoofing"  # spoofing often starts by jamming the real signals
                self._absorb(e, sig)
            else:
                self._off += 1
                if self._off >= self.s.min_off_s:
                    done += self._close()
        return done

    def flush(self) -> list[Event]:
        return self._close()

    def _absorb(self, e: Epoch, sig: Signals) -> None:
        ev = self.open
        assert ev is not None
        ev.end = e.t
        ev.peak_cno_drop_db = max(ev.peak_cno_drop_db, sig.cno_drop)
        ev.peak_agc_shift = max(ev.peak_agc_shift, sig.agc_shift)
        ev.peak_jam_ind_rise = max(ev.peak_jam_ind_rise, sig.jam_rise)
        ev.max_offset_m = max(ev.max_offset_m, sig.offset_m)
        if sig.cno_drop < 0:
            ev.peak_cno_rise_db = max(ev.peak_cno_rise_db, -sig.cno_drop)
        for code in sig.evidence:
            if code not in ev.evidence:
                ev.evidence.append(code)

    def _close(self, gap: bool = False) -> list[Event]:
        ev = self.open
        self.open, self._off, self._on = None, 0, 0
        if ev is None:
            return []
        ev.closed_by_gap = gap
        c = set(ev.evidence)
        groups = {
            "signal": bool(c & {"cno_drop", "no_sats"}),
            "gain": "agc" in c,
            "indicator": "jam_ind" in c,
            "receiver": bool(c & {"rx_jam", "rx_spoof"}),
            "position": "offset" in c,
            "stronger": "cno_rise" in c,
        }
        n = sum(groups.values())
        ev.confidence = "High" if n >= 3 or (n >= 2 and groups["receiver"]) else "Medium" if n >= 2 else "Low"
        return [ev]


EVIDENCE_TEXT = {
    "cno_drop": "Every strong satellite got weaker at once (peak {peak_cno_drop_db:.1f} dB below normal)",
    "no_sats": "No satellites could be received",
    "agc": "Front-end gain moved away from normal (peak {peak_agc_shift:.0%})",
    "jam_ind": "Receiver's jamming indicator rose (peak +{peak_jam_ind_rise:.0f})",
    "rx_jam": "Receiver raised its own jamming flag",
    "fix_lost": "Position fix was lost",
    "rx_spoof": "Receiver raised its own spoofing flag",
    "offset": "Static antenna appeared to move (up to {max_offset_m:.0f} m)",
    "cno_rise": "Signals were stronger than normal (peak {peak_cno_rise_db:.1f} dB)",
}


def describe(ev: Event) -> list[str]:
    """Plain-English evidence lines for an event."""
    return [EVIDENCE_TEXT[c].format(**vars(ev)) for c in ev.evidence if c in EVIDENCE_TEXT]


def detect(epochs: Iterable[Epoch], settings: Optional[Settings] = None) -> Iterator[Event]:
    d = Detector(settings)
    for e in epochs:
        yield from d.feed(e)
    yield from d.flush()
