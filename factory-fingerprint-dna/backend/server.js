/**
 * Factory Fingerprint DNA — example backend (NEXT PHASE)
 * -----------------------------------------------------
 * This is a minimal Node/Express server that shows how real ESP32 readings
 * would flow into the system. It is NOT wired into the dashboard right now —
 * the dashboard (js/app.js) still uses its own in-browser simulation.
 *
 * To actually connect them later:
 *   1. Run this server (`npm install` then `npm start`).
 *   2. Point your ESP32 sketches at POST http://<this-server-ip>:3000/api/reading.
 *   3. In js/app.js, replace the body of readSensors(m) with a fetch() call to
 *      GET /api/latest and assign the returned values to m.live instead of
 *      generating them locally.
 *
 * This server keeps everything in memory for simplicity — swap in a real
 * database (SQLite/Postgres/Mongo) before using this for anything long-term.
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory store: latest reading + short history per machine
const latest = { 1: null, 2: null, 3: null };
const history = { 1: [], 2: [], 3: [] };
const MAX_HISTORY = 200;

// Receive a reading from an ESP32 node
// Body: { machineId: 1, temp: 31.2, vib: 0.21, current: 0.81, rpm: 1498 }
app.post("/api/reading", (req, res) => {
  const { machineId, temp, vib, current, rpm } = req.body || {};

  if (![1, 2, 3].includes(machineId)) {
    return res.status(400).json({ error: "machineId must be 1, 2 or 3" });
  }
  if ([temp, vib, current, rpm].some((v) => typeof v !== "number" || Number.isNaN(v))) {
    return res.status(400).json({ error: "temp, vib, current and rpm must all be numbers" });
  }

  const reading = { machineId, temp, vib, current, rpm, timestamp: Date.now() };
  latest[machineId] = reading;
  history[machineId].push(reading);
  if (history[machineId].length > MAX_HISTORY) history[machineId].shift();

  res.json({ ok: true, reading });
});

// Latest reading for every machine — this is what the dashboard would poll
app.get("/api/latest", (req, res) => {
  res.json(latest);
});

// Recent history for one machine, e.g. GET /api/history/2
app.get("/api/history/:machineId", (req, res) => {
  const id = Number(req.params.machineId);
  if (!history[id]) return res.status(404).json({ error: "unknown machineId" });
  res.json(history[id]);
});

app.get("/", (req, res) => {
  res.send("Factory Fingerprint DNA backend is running. See /api/latest and /api/history/:id");
});

app.listen(PORT, () => {
  console.log(`Factory Fingerprint DNA backend listening on port ${PORT}`);
});
