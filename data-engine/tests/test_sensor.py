"""Run with:  python -m unittest discover tests"""
import io
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sensor import detector, sim, store  # noqa: E402

T0 = 1_790_000_000.0


def run(stream):
    return list(detector.detect(stream))


class Detector(unittest.TestCase):
    def test_quiet_day_has_no_false_alarms(self):
        for seed in range(3):
            self.assertEqual(run(sim.quiet(T0, 6 * 3600, seed=seed)), [], f"seed {seed}")

    def test_jamming_is_found_with_the_right_times(self):
        start = T0 + 3600
        evs = run(sim.with_jamming(sim.quiet(T0, 7200), start, start + 600, strength_db=12))
        self.assertEqual(len(evs), 1)
        ev = evs[0]
        self.assertEqual(ev.kind, "jamming")
        self.assertLessEqual(abs(ev.start - start), 2)
        self.assertLessEqual(abs(ev.end - (start + 600)), 2)
        self.assertEqual(ev.confidence, "High")

    def test_weak_jamming_still_found(self):
        start = T0 + 3600
        evs = run(sim.with_jamming(sim.quiet(T0, 7200), start, start + 300, strength_db=6))
        self.assertEqual([e.kind for e in evs], ["jamming"])

    def test_total_signal_loss_is_jamming(self):
        start = T0 + 3600
        evs = run(sim.with_jamming(sim.quiet(T0, 7200), start, start + 300, strength_db=30))
        self.assertEqual(len(evs), 1)
        self.assertIn("no_sats", evs[0].evidence)
        self.assertIn("fix_lost", evs[0].evidence)

    def test_spoofing_is_found_from_apparent_movement(self):
        start = T0 + 3600
        evs = run(sim.with_spoofing(sim.quiet(T0, 7200), start, start + 600))
        self.assertEqual([e.kind for e in evs], ["spoofing"])
        self.assertIn("offset", evs[0].evidence)
        self.assertGreater(evs[0].max_offset_m, 500)

    def test_blocked_satellites_are_not_interference(self):
        start = T0 + 3600
        self.assertEqual(run(sim.with_blockage(sim.quiet(T0, 7200), start, start + 900)), [])

    def test_a_two_second_blip_is_ignored(self):
        start = T0 + 3600
        self.assertEqual(run(sim.with_jamming(sim.quiet(T0, 7200), start, start + 2, strength_db=12)), [])

    def test_nothing_is_flagged_before_the_baseline_is_learned(self):
        evs = run(sim.with_jamming(sim.quiet(T0, 1800), T0 + 600, T0 + 900, strength_db=12))
        # Without a baseline only the receiver's own flag counts, which alone is not enough.
        self.assertEqual(evs, [])

    def test_a_data_gap_closes_an_open_event(self):
        start = T0 + 3600
        eps = [e for e in sim.with_jamming(sim.quiet(T0, 7200), start, start + 600) if not (start + 100 <= e.t < start + 200)]
        evs = run(eps)
        self.assertTrue(evs[0].closed_by_gap)

    def test_descriptions_are_plain_english(self):
        start = T0 + 3600
        ev = run(sim.with_jamming(sim.quiet(T0, 7200), start, start + 600))[0]
        lines = detector.describe(ev)
        self.assertTrue(any("weaker" in x for x in lines))


class Receiver(unittest.TestCase):
    def test_ubx_messages_become_epochs(self):
        from pyubx2 import UBXMessage, GET
        from sensor.ubx import epochs_from_stream

        buf = io.BytesIO()
        for s in range(3):
            sats = {"numSvs": 6}
            for i in range(1, 7):
                sats.update({f"gnssId_{i:02d}": 0, f"svId_{i:02d}": i, f"cno_{i:02d}": 40 + i, f"elev_{i:02d}": 10 if i == 6 else 40,
                             f"azim_{i:02d}": 10 * i, f"prRes_{i:02d}": 0, f"svUsed_{i:02d}": 1})
            buf.write(UBXMessage("NAV", "NAV-SAT", GET, iTOW=s * 1000, version=1, **sats).serialize())
            buf.write(UBXMessage("MON", "MON-RF", GET, version=0, nBlocks=1, blockId_01=0, jammingState_01=1, antStatus_01=2,
                                 antPower_01=1, postStatus_01=0, noisePerMS_01=90, agcCnt_01=5000, jamInd_01=12, ofsI_01=0,
                                 magI_01=0, ofsQ_01=0, magQ_01=0).serialize())
            buf.write(UBXMessage("NAV", "NAV-STATUS", GET, iTOW=s * 1000, gpsFix=3, spoofDetState=1).serialize())
            buf.write(UBXMessage("NAV", "NAV-PVT", GET, iTOW=s * 1000, year=2026, month=10, day=17, hour=8, min=0, second=s,
                                 validDate=1, validTime=1, fixType=3, gnssFixOk=1, numSV=5, lon=2.0, lat=54.0, hAcc=1500).serialize())
        buf.seek(0)
        eps = list(epochs_from_stream(buf))
        self.assertEqual(len(eps), 3)
        e = eps[0]
        self.assertEqual(e.fix, 3)
        self.assertAlmostEqual(e.h_acc_m, 1.5)
        self.assertEqual(e.cno_top, 43.0)   # satellites 1-5 (41..45); the low one (elev 10) is excluded
        self.assertEqual(e.sats_tracked, 5)
        self.assertEqual(e.agc, 5000)
        self.assertEqual(e.jam_ind, 12)
        self.assertEqual(e.jam_state, 1)
        self.assertEqual(e.spoof_state, 1)


class Storage(unittest.TestCase):
    def test_round_trip_and_export_has_no_coordinates(self):
        import witnessmark_sensor as cli

        with tempfile.TemporaryDirectory() as d:
            dbp, out = os.path.join(d, "s.db"), os.path.join(d, "ev.csv")
            db = store.connect(dbp)
            start = T0 + 3600
            n = cli.process(db, "site-01", sim.with_jamming(sim.quiet(T0, 7200), start, start + 600), quiet=True)
            self.assertEqual(n, 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM epochs").fetchone()[0], 7200)
            self.assertEqual(len(list(store.load_epochs(db, "site-01"))), 7200)
            cli.main(["--db", dbp, "export", "--site", "site-01", "--out", out])
            text = open(out).read()
            self.assertNotIn("54.0", text)
            header = set(text.split("\n")[0].lower().split(","))
            self.assertFalse(header & {"lat", "lon", "latitude", "longitude"})
            self.assertIn("jamming", text)

    def test_site_names_cannot_be_addresses(self):
        import witnessmark_sensor as cli
        with self.assertRaises(SystemExit):
            cli._check_site("12 High Street, London")


if __name__ == "__main__":
    unittest.main()
