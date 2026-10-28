# Witnessmark data engine v0.2

This is the start of "GPS weather for drones". It has three parts:

- **collector.py** (the collector + memory): downloads real aircraft GPS-interference data from Stanford GPS Lab and saves it into `witnessmark.db`, a database file on your laptop. Every hour it runs, your history grows.
- **witnessmark_sensor.py** (the ground sensor, new): runs on a Raspberry Pi with a u-blox GNSS receiver, learns what "normal" looks like at the site and records jamming and spoofing events automatically. **This is the data nobody else has.**
- **route_risk.py** (the forecaster): give it a drone route; it splits the route into ~1 km sections and gives each a risk level (LOW / ELEVATED / HIGH / UNKNOWN), a reason and a confidence.

## First-time setup (5 minutes)

1. Open Terminal (Mac) or PowerShell (Windows) and go into this folder:
   `cd path/to/witnessmark`
2. Install the two libraries:
   `pip install -r requirements.txt`
3. Check everything works (no internet needed; uses fake data):
   `python test_with_fake_data.py` → should end with **ALL TESTS PASSED**

## Collect real data

1. Fill in the last two weeks (takes a few minutes):
   `python collector.py --backfill 2026/10/01 2026/10/15`
2. See what you've got:
   `python collector.py --stats`
3. Keep collecting (leave the window open; laptop must stay awake):
   `python collector.py --loop`

If you close it, nothing is lost. Run `--once` or `--backfill` later to fill the gap.

## Ground sensor (your own data)

**Receive-only.** The sensor only listens. Never build, buy or test a jammer or anything that transmits on GPS frequencies: it's illegal in the UK and puts aircraft and emergency services at risk.

**Privacy.** The database keeps the antenna's position on the device, because a static antenna that suddenly "moves" is the clearest sign of spoofing. Nothing is uploaded. Reports and exports never include coordinates, only the site name you choose, so call it something like `site-01`, never your street.

### Shopping list (rough prices, check current ones)
| Part | Why | Approx. |
|---|---|---|
| u-blox ZED-F9P board (e.g. SparkFun or ArduSimple) | Multi-band receiver with jamming and spoofing monitors | £180–250 |
| Multi-band GNSS antenna (L1/L2 or L1/L5) | Hears all the bands the receiver supports | £50–100 |
| Raspberry Pi 4 or 5 + power supply + 64 GB SD card | Runs the logger 24/7 | £70–100 |
| Antenna cable/extension and a small metal plate (~10 cm) | Gets the antenna to the window sill; reduces reflections | £10–20 |

A cheaper u-blox M8/M9 board (£30–60) also works for a first test; it reports jamming but not as well.

### Try it without hardware
```
pip install -r requirements.txt
python witnessmark_sensor.py simulate --scenario jamming     # also: quiet, strong-jamming, spoofing, blockage
python -m unittest discover tests                          # 13 checks, should end with OK
```
Simulated data is clearly labelled and uses a made-up point in the North Sea.

### Run it for real
1. Plug the receiver into the Pi by USB. Put the antenna by the window (outside sill is best) on the metal plate. Don't move it afterwards.
2. `python witnessmark_sensor.py run --port /dev/ttyACM0 --site site-01`
3. Leave it. It needs **30 minutes** to learn the site before it can flag anything, and a week to know what a normal week looks like.
4. To start automatically at boot, follow the comments in `deploy/witnessmark-sensor.service`. Add `deploy/prune.cron` so the SD card doesn't fill up.

### Demo data for the website
- `python make_demo_data.py` rewrites the sample routes and flight logs in `public/demo-data/` (all simulated).
- `python witnessmark_sensor.py simulate --scenario jamming --hours 1.5 --seed 3 --csv ../public/demo-data/sensor-jamming-event.csv` writes a sample sensor log. Real sensor logs in the same format can be uploaded on the website's Site monitoring page.

### See what it found
- `python witnessmark_sensor.py report --site site-01 --days 7`: coverage, average signal strength, events.
- `python witnessmark_sensor.py export --site site-01 --out events.csv`: events only, no coordinates, safe to share.
- Record raw data for later checks: u-center or `cat /dev/ttyACM0 > raw.ubx`, then `python witnessmark_sensor.py replay raw.ubx --site site-01`.

### What it looks for
| Sign | Means |
|---|---|
| Every strong satellite gets weaker at the same moment | Jamming (an obstruction only blocks some) |
| Front-end gain moves away from normal | Extra noise in the GNSS band |
| Receiver's own jamming indicator or flag | The receiver's built-in monitor agrees |
| Fix lost while signals were fine | Strong jamming |
| A static antenna appears to move while claiming good accuracy | Spoofing |
| Signals stronger than normal | Often spoofing |

An event needs at least two signs together for 5 seconds, so a passing lorry or a 2-second glitch doesn't count. Confidence is **High** with three independent signs (or two plus the receiver's own flag), **Medium** with two, **Low** otherwise. Thresholds are provisional until tuned on real data.

### Checking it against the real world
When the CAA announces a GPS jamming exercise (published as NOTAMs and on CAA SkyWise), write down the dates and compare them with your events. Matches, misses and false alarms are the evidence that the sensor works. Keep the notes.

## Check a route

`python route_risk.py example_route.csv`

The example is a ~2.8 km hop between St Thomas' and Guy's hospitals (an illustrative route, not a real flight plan). To check your own route, make a CSV with `lat,lon` columns, one waypoint per row, in flying order.

Options: `--days 30` (how far back), `--section-km 0.5` (shorter sections), `--radius-km 10`.

## Send data to the Lovable app

`python collector.py --export` creates `export/sky_events.csv` and `export/sky_hexes.csv`. Upload them on the app's Admin Import page.

## What to expect (honest)

- **London will mostly show LOW.** That's correct: planes over London rarely see jamming. The real risk for drones is ground-level jammers, which planes can't see. That's why the sensors matter.
- **The Stanford file format is my best understanding, not yet tested on the real server** (my workspace can't reach it). If `--stats` shows 0 area readings after a backfill, send me the output and I'll fix it.
- **Licence:** Stanford data is CC BY-NC 4.0, fine for building and testing. Don't sell anything built on it until you have Stanford's permission.
- **The thresholds are provisional (Route Method v0.1)** and will be tuned once there's real data.

## Files

| File | What it is |
|---|---|
| collector.py | Downloads and stores data |
| route_risk.py | Scores a route |
| example_route.csv | Sample London route |
| test_with_fake_data.py | Self-test (fake data only) |
| witnessmark.db | Your database (created on first run; back it up, it's your history) |
| witnessmark_sensor.py | Ground sensor: run, replay, simulate, report, export |
| sensor/ | Sensor code: receiver reader, detector, storage, simulator |
| tests/ | Sensor checks (`python -m unittest discover tests`) |
| deploy/ | Start-at-boot service and clean-up job for a Raspberry Pi |
| sensor.db | The sensor's database (stays on the device; contains the antenna position) |
