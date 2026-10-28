"""Reads a u-blox receiver (live over USB/serial, or a recorded .ubx file) and turns its
messages into one Epoch per second.

Receive-only: the only bytes we ever send are configuration commands to our own receiver
telling it which status messages to output. Nothing is transmitted over the air.

Messages used:
  NAV-PVT     fix type, satellites used, accuracy estimate, position
  NAV-SAT     signal strength (C/N0) and elevation of every satellite
  NAV-STATUS  spoofing detection state
  MON-RF      jamming indicator, AGC and jamming flag (u-blox M9/F9 and newer)
  MON-HW      the same for older receivers (u-blox M8)
"""
from __future__ import annotations

import calendar
from typing import BinaryIO, Iterator, Optional

from .model import Epoch

MIN_ELEV_DEG = 15
TOP_N = 8


def configure(stream: BinaryIO) -> None:
    """Ask the receiver to output the messages we need once per second and switch on
    its interference monitor. Sends both the new (M9/F9) and old (M8) style commands;
    a receiver simply ignores the style it doesn't understand."""
    from pyubx2 import UBXMessage

    keys = []
    for msg in ("NAV_PVT", "NAV_SAT", "NAV_STATUS", "MON_RF"):
        for port in ("USB", "UART1"):
            keys.append((f"CFG_MSGOUT_UBX_{msg}_{port}", 1))
    keys += [("CFG_ITFM_ENABLE", 1)]
    # RAM and battery-backed RAM, so the setting survives a short power cut.
    stream.write(UBXMessage.config_set(3, 0, keys).serialize())
    for cls, mid in ((0x01, 0x07), (0x01, 0x35), (0x01, 0x03), (0x0A, 0x09)):  # NAV-PVT, NAV-SAT, NAV-STATUS, MON-HW
        stream.write(UBXMessage("CFG", "CFG-MSG", 0, msgClass=cls, msgID=mid, rateUSB=1, rateUART1=1).serialize())


class Assembler:
    """Combines the latest messages into one Epoch each time a NAV-PVT arrives."""

    def __init__(self) -> None:
        self.sat: Optional[tuple[Optional[float], int]] = None
        self.rf: Optional[tuple[Optional[float], Optional[float], int]] = None
        self.spoof_state = 0

    def add(self, msg) -> Optional[Epoch]:  # msg: pyubx2.UBXMessage
        ident = getattr(msg, "identity", "")
        if ident == "NAV-SAT":
            cnos = []
            for i in range(1, int(getattr(msg, "numSvs", 0)) + 1):
                c = getattr(msg, f"cno_{i:02d}", 0) or 0
                el = getattr(msg, f"elev_{i:02d}", 0) or 0
                if c > 0 and el >= MIN_ELEV_DEG:
                    cnos.append(float(c))
            cnos.sort(reverse=True)
            top = cnos[:TOP_N]
            self.sat = (round(sum(top) / len(top), 2) if len(top) >= 4 else None, len(cnos))
        elif ident == "MON-RF":
            # Block 1 is the L1 band on every receiver; use it for a consistent series.
            self.rf = (getattr(msg, "agcCnt_01", None), getattr(msg, "jamInd_01", None), int(getattr(msg, "jammingState_01", 0) or 0))
        elif ident == "MON-HW" and self.rf is None:
            self.rf = (getattr(msg, "agcCnt", None), getattr(msg, "jamInd", None), int(getattr(msg, "jammingState", 0) or 0))
        elif ident == "NAV-STATUS":
            self.spoof_state = int(getattr(msg, "spoofDetState", 0) or 0)
        elif ident == "NAV-PVT":
            if not getattr(msg, "validDate", 0) or not getattr(msg, "validTime", 0):
                return None
            t = calendar.timegm((msg.year, msg.month, msg.day, msg.hour, msg.min, msg.second, 0, 0, 0))
            fix = int(msg.fixType) if getattr(msg, "gnssFixOk", 0) else 0
            cno, tracked = self.sat if self.sat else (None, 0)
            agc, jam, jstate = self.rf if self.rf else (None, None, 0)
            return Epoch(
                t=float(t), fix=fix, num_sv=int(msg.numSV), h_acc_m=(msg.hAcc / 1000.0) if fix >= 2 else None,
                cno_top=cno, sats_tracked=tracked, agc=float(agc) if agc is not None else None,
                jam_ind=float(jam) if jam is not None else None, jam_state=jstate, spoof_state=self.spoof_state,
                lat=float(msg.lat) if fix >= 2 else None, lon=float(msg.lon) if fix >= 2 else None,
            )
        return None


def epochs_from_stream(stream: BinaryIO) -> Iterator[Epoch]:
    """Yields epochs from a live serial port or a recorded .ubx file."""
    from pyubx2 import UBXReader, UBX_PROTOCOL

    reader = UBXReader(stream, protfilter=UBX_PROTOCOL, quitonerror=0)
    asm = Assembler()
    for _raw, msg in reader:
        if msg is None:
            continue
        e = asm.add(msg)
        if e is not None:
            yield e
