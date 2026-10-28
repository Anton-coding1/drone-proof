"""Synthetic receiver data for testing and demos. Clearly labelled: not real measurements."""
from __future__ import annotations

import math
import random
from typing import Iterator

from .model import Epoch

# A made-up reference point in the North Sea, so simulated data can never point at a real home.
SIM_LAT, SIM_LON = 54.0, 2.0


def quiet(start: float, seconds: int, seed: int = 1, lat: float = SIM_LAT, lon: float = SIM_LON) -> Iterator[Epoch]:
    """A normal day: slow daily drift in signal strength, small noise, an occasional blocked satellite."""
    rnd = random.Random(seed)
    for i in range(seconds):
        t = start + i
        diurnal = 1.2 * math.sin(2 * math.pi * (t % 86400) / 86400)
        cno = 44.0 + diurnal + rnd.gauss(0, 0.6)
        if rnd.random() < 0.002:  # someone walks past the window
            cno -= 1.5
        yield Epoch(
            t=t, fix=3, num_sv=18 + rnd.randint(-2, 2), h_acc_m=1.2 + abs(rnd.gauss(0, 0.2)),
            cno_top=round(cno, 2), sats_tracked=22, agc=5200 + rnd.gauss(0, 40), jam_ind=8 + abs(rnd.gauss(0, 2)),
            jam_state=1, spoof_state=1,
            lat=lat + rnd.gauss(0, 4e-6), lon=lon + rnd.gauss(0, 6e-6),
        )


def with_jamming(epochs: Iterator[Epoch], start: float, end: float, strength_db: float = 12.0) -> Iterator[Epoch]:
    """Add a broadband jammer between start and end."""
    for e in epochs:
        if start <= e.t < end:
            e.cno_top = None if strength_db > 25 else (e.cno_top or 44) - strength_db
            e.sats_tracked = 0 if strength_db > 25 else max(0, e.sats_tracked - int(strength_db / 2))
            e.agc = (e.agc or 5200) * (1 - min(0.6, strength_db / 30))
            e.jam_ind = min(255, (e.jam_ind or 8) + strength_db * 6)
            e.jam_state = 3 if strength_db > 15 else 2 if strength_db > 8 else 1
            if strength_db > 18:
                e.fix, e.num_sv, e.h_acc_m = 0, 0, None
            else:
                e.h_acc_m = (e.h_acc_m or 1.2) * (1 + strength_db / 3)
        yield e


def with_spoofing(epochs: Iterator[Epoch], start: float, end: float, drift_m_per_s: float = 2.0) -> Iterator[Epoch]:
    """A spoofer that captures the receiver and slowly drags the position north."""
    for e in epochs:
        if start <= e.t < end and e.lat is not None:
            moved = drift_m_per_s * (e.t - start)
            e.lat += moved / 111_320
            e.cno_top = (e.cno_top or 44) + 5
            e.spoof_state = 2 if e.t - start > 20 else 1
        yield e


def with_blockage(epochs: Iterator[Epoch], start: float, end: float) -> Iterator[Epoch]:
    """A lorry parks in front of the antenna: a few satellites drop, the rest are fine. Not interference."""
    for e in epochs:
        if start <= e.t < end:
            e.cno_top = (e.cno_top or 44) - 1.8
            e.sats_tracked -= 5
            e.num_sv = max(4, e.num_sv - 5)
        yield e
