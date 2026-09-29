# Factory Fingerprint DNA
### AI-Based Digital Fingerprint for Smart Factory Predictive Maintenance

A student/prototype project that demonstrates how a factory could compare each
machine's live sensor readings against its own "normal fingerprint" and turn
that comparison into a simple health status — Good, Average, or Bad — instead
of just showing raw numbers.

---

## Current project status (read this first)

| Layer | Status |
|---|---|
| Frontend / dashboard (5 modules) | ✅ Functional |
| Deviation / digital-fingerprint scoring logic | ✅ Functional |
| 3-machine demonstration (Good / Average / Bad) | ✅ Functional |
| Real ESP32 sensor integration | 🔄 Next phase — see `/hardware` |
| Backend / API to receive real sensor data | 🔄 Next phase — see `/backend` |
| Trained ML fault-prediction model | 🔄 Future enhancement |

**Honest framing for a report or a viva:** the dashboard in this repo runs on
**simulated sensor data**, generated in the browser. It is not connected to a
real ESP32 right now. The simulation is deliberately isolated in a single
function (`readSensors()` in `js/app.js`) so the real hardware pipeline can be
plugged in later without touching the rest of the site. `/hardware` and
`/backend` contain working example code for that next phase — they are not
yet wired into the dashboard.

Say this, not "our AI detects real faults":
> "Our prototype uses a weighted deviation analysis to compare machine
> operating data against its normal digital fingerprint and classify machine
> health as Good, Average, or Bad. The current dashboard uses simulated
> sensor data; the architecture is designed so a real ESP32 → backend feed
> can replace the simulation without changing the rest of the system."

---

## How the health status is actually calculated

The status is **not hardcoded**. It's the output of a small calculation:

```
Live sensor values → compare with baseline fingerprint → weighted deviation score → status
```

**Normal digital fingerprint (baseline):**

| Parameter | Baseline value |
|---|---|
| Temperature | 31 °C |
| Vibration | 0.20 g |
| Current | 0.8 A |
| RPM | 1500 |

**Deviation formula** (see `deviation()` in `js/app.js`):

```
deviation = 0.30 × |Δtemp| / baseline_temp
          + 0.30 × |Δvib|  / baseline_vib
          + 0.15 × |Δcurrent| / baseline_current
          + 0.25 × |Δrpm| / baseline_rpm
```

Temperature and vibration are weighted highest because they're the most
physically informative signals for a developing motor/bearing fault; current
is a secondary confirmation signal; RPM catches load- or speed-related faults.

**Status thresholds:**

| Deviation score | Status |
|---|---|
| < 0.15 | 🟢 GOOD |
| 0.15 – 0.45 | 🟡 AVERAGE |
| > 0.45 | 🔴 BAD |

One physical detail worth knowing for Q&A: for the "bad" machine, **RPM is
set below baseline, not above** (1260 vs. 1500). A struggling or worn motor
typically loses speed under load rather than speeding up — this mirrors real
induction-motor fault behavior.

---

## Website structure (5 modules)

1. **Dashboard** — all three machines' current status at a glance.
2. **Live Monitoring** — real-time temperature, vibration, current and RPM charts.
3. **Digital Fingerprint** — a radar chart per machine comparing its live pattern to the baseline fingerprint.
4. **Alerts** — an auto-generated log every time a machine's status changes.
5. **Reports** — running averages, peak values, and "time in normal" per machine.

---

## Project structure

```
factory-fingerprint-dna/
├── index.html              # main page — open this in a browser to run the dashboard
├── css/
│   └── style.css           # all dashboard styling (light/dark aware)
├── js/
│   └── app.js               # simulation, deviation scoring, charts, all UI logic
├── hardware/
│   └── esp32_node/
│       └── esp32_node.ino  # NEXT PHASE: example ESP32 sketch (DS18B20, SW-420, ACS712, IR/RPM)
├── backend/
│   ├── server.js           # NEXT PHASE: example Node/Express API to receive ESP32 readings
│   └── package.json
└── README.md                # this file
```

---

## Running the website (current phase)

No build step, no server required — it's a static site.

1. Download/unzip the project.
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox).
3. The three machines start updating immediately, once every 2 seconds.

If you'd rather serve it (recommended for consistent font loading over
`file://`), from the project folder run any static server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Full architecture: current phase vs. next phase

**Current phase (this repo, working today):**

```
Simulated sensor values (js/app.js) → deviation scoring → dashboard UI
```

**Next phase (hardware, not yet connected):**

```
DS18B20 (temp) ─┐
SW-420 (vibration) ─┤
ACS712 (current) ─┼── ESP32 ── Wi-Fi ── Backend API (backend/server.js) ── Dashboard (index.html)
IR/Hall sensor (RPM) ─┘
```

To connect them for real:

1. Flash `hardware/esp32_node/esp32_node.ino` onto one ESP32 per machine, after
   filling in your Wi-Fi credentials and backend URL, and wiring the sensors
   per the pin map comment at the top of the file.
2. Run `backend/server.js` (`npm install && npm start`) on a machine reachable
   by the ESP32s over your local network.
3. In `js/app.js`, replace the contents of `readSensors(m)` with a `fetch()`
   call to the backend's `GET /api/latest` endpoint, and assign the response
   into `m.live` instead of generating it locally. Nothing else in the
   dashboard needs to change — the UI, charts, deviation scoring and alerts
   all read from `m.live` regardless of where it comes from.

---

## Known limitations (be upfront about these)

- Sensor data is simulated, not live, in this delivered version.
- The SW-420 module used in the example sketch is a threshold switch, not a
  true accelerometer — it gives a rough vibration proxy, not a calibrated
  g-force reading. For a real deployment, swap in an ADXL335 or MPU6050.
- The backend example stores data in memory only; it has no database and
  will lose history on restart. That's fine for a demo, not for production.
- No ML model has been trained on real fault data. The current classification
  is a rule-based weighted deviation score, which is a legitimate and
  explainable approach for a prototype, but it is not a trained/validated
  machine-learning model.

---

## Possible future enhancements

- Replace the rule-based deviation score with a trained anomaly-detection
  model (e.g. Isolation Forest or an autoencoder) once real labeled fault
  data is available.
- Add persistent storage (SQLite/Postgres) and authentication to the backend.
- Add WebSocket push instead of polling, for lower-latency live updates.
- Add a calibration mode to auto-learn each machine's baseline fingerprint
  from its own first few hours of healthy operation, instead of a fixed
  hand-set baseline.
