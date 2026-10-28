"""Data types shared by the receiver reader, the detector and the store."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Epoch:
    """One second of receiver health, reduced to what the detector needs.

    Position is kept only to measure how far a *static* antenna appears to move
    (a strong sign of spoofing). It is stored locally and never exported.
    """
    t: float                      # UNIX time, seconds (UTC)
    fix: int                      # 0 none, 2 = 2D, 3 = 3D, 4 = GNSS+DR, 5 time only
    num_sv: int                   # satellites used in the fix
    h_acc_m: Optional[float]      # receiver's own horizontal accuracy estimate
    cno_top: Optional[float]      # mean C/N0 (dB-Hz) of the strongest satellites above 15° elevation
    sats_tracked: int             # satellites with a usable signal
    agc: Optional[float]          # automatic gain control count (front end)
    jam_ind: Optional[float]      # receiver's continuous-wave jamming indicator, 0-255
    jam_state: int = 0            # receiver jamming flag: 0 unknown, 1 ok, 2 warning, 3 critical
    spoof_state: int = 0          # receiver spoofing flag: 0 unknown, 1 none, 2 indicated, 3 multiple
    lat: Optional[float] = None
    lon: Optional[float] = None


@dataclass
class Event:
    kind: str                     # "jamming" or "spoofing"
    start: float
    end: float
    confidence: str               # "High", "Medium" or "Low"
    evidence: list[str] = field(default_factory=list)   # evidence codes, see detector.describe()
    peak_cno_drop_db: float = 0.0
    peak_agc_shift: float = 0.0
    peak_jam_ind_rise: float = 0.0
    max_offset_m: float = 0.0
    peak_cno_rise_db: float = 0.0
    closed_by_gap: bool = False

    @property
    def duration_s(self) -> float:
        return max(0.0, self.end - self.start)
