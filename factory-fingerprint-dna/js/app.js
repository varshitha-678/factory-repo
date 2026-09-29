// ============================================================
// FACTORY FINGERPRINT DNA
// app.js - matches the supplied index.html + backend/server.js
// ============================================================

const API_BASE = "http://localhost:3000";

// ------------------------------------------------------------
// DIGITAL FINGERPRINT BASELINE
// ------------------------------------------------------------

const BASELINE = {
  temp: 31,
  vib: 0.20,
  current: 0.8,
  rpm: 1500
};

// Weighted deviation
const WEIGHTS = {
  temp: 0.30,
  vib: 0.30,
  current: 0.15,
  rpm: 0.25
};

// ------------------------------------------------------------
// SIMULATION TARGETS
// Machine 1 = Good
// Machine 2 = Average
// Machine 3 = Bad
// ------------------------------------------------------------

const machineTargets = {
  1: {
    temp: 31,
    vib: 0.20,
    current: 0.80,
    rpm: 1500
  },

  2: {
    temp: 38,
    vib: 0.38,
    current: 1.00,
    rpm: 1380
  },

  3: {
    temp: 48,
    vib: 0.70,
    current: 1.50,
    rpm: 1260
  }
};

let latestData = {
  1: null,
  2: null,
  3: null
};

let historyData = {
  1: [],
  2: [],
  3: []
};

let alertHistory = [];

let charts = {};


// ============================================================
// UTILITY
// ============================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomAround(value, variation) {
  return value + (Math.random() * 2 - 1) * variation;
}

function fmt(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}


// ============================================================
// WEIGHTED DEVIATION
// ============================================================

function calculateDeviation(reading) {

  const tempDeviation =
    Math.abs(reading.temp - BASELINE.temp) /
    BASELINE.temp;

  const vibDeviation =
    Math.abs(reading.vib - BASELINE.vib) /
    BASELINE.vib;

  const currentDeviation =
    Math.abs(reading.current - BASELINE.current) /
    BASELINE.current;

  const rpmDeviation =
    Math.abs(reading.rpm - BASELINE.rpm) /
    BASELINE.rpm;

  return (
    tempDeviation * WEIGHTS.temp +
    vibDeviation * WEIGHTS.vib +
    currentDeviation * WEIGHTS.current +
    rpmDeviation * WEIGHTS.rpm
  );
}


// ============================================================
// MACHINE STATUS
// ============================================================

function getHealth(reading) {

  const deviation =
    calculateDeviation(reading);

  const score =
    clamp(100 - deviation * 100, 0, 100);

  let status;

  if (deviation <= 0.12) {
    status = "GOOD";
  }
  else if (deviation <= 0.35) {
    status = "AVERAGE";
  }
  else {
    status = "BAD";
  }

  return {
    status,
    deviation,
    score
  };
}


// ============================================================
// SIMULATED SENSOR DATA
// ============================================================

function readSensors(machineId) {

  const target =
    machineTargets[machineId];

  let variation;

  if (machineId === 1) {

    variation = {
      temp: 0.5,
      vib: 0.015,
      current: 0.03,
      rpm: 15
    };

  }
  else if (machineId === 2) {

    variation = {
      temp: 1.0,
      vib: 0.04,
      current: 0.05,
      rpm: 25
    };

  }
  else {

    variation = {
      temp: 1.5,
      vib: 0.06,
      current: 0.08,
      rpm: 30
    };
  }

  return {

    machineId,

    temp: Number(
      randomAround(
        target.temp,
        variation.temp
      ).toFixed(2)
    ),

    vib: Number(
      randomAround(
        target.vib,
        variation.vib
      ).toFixed(3)
    ),

    current: Number(
      randomAround(
        target.current,
        variation.current
      ).toFixed(2)
    ),

    rpm: Math.round(
      randomAround(
        target.rpm,
        variation.rpm
      )
    )
  };
}


// ============================================================
// SEND DATA TO BACKEND
// ============================================================

async function sendReading(reading) {

  try {

    const response =
      await fetch(
        `${API_BASE}/api/reading`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(reading)
        }
      );

    if (!response.ok) {
      throw new Error(
        `Backend error: ${response.status}`
      );
    }

    return await response.json();

  }
  catch (error) {

    console.error(
      "Unable to send reading:",
      error
    );

    return null;
  }
}


// ============================================================
// GET LATEST DATA
// ============================================================

async function getLatest() {

  try {

    const response =
      await fetch(
        `${API_BASE}/api/latest`
      );

    if (!response.ok) {
      throw new Error(
        `Backend error: ${response.status}`
      );
    }

    const data =
      await response.json();

    latestData = data;

    return data;

  }
  catch (error) {

    console.error(
      "Unable to get latest data:",
      error
    );

    return null;
  }
}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

  const container =
    document.getElementById(
      "dashboard-cards"
    );

  if (!container) return;

  let html = "";

  for (let id = 1; id <= 3; id++) {

    const reading =
      latestData[id];

    if (!reading) continue;

    const health =
      getHealth(reading);

    let icon = "🟢";

    if (health.status === "AVERAGE") {
      icon = "🟡";
    }

    if (health.status === "BAD") {
      icon = "🔴";
    }

    html += `
      <div class="card machine-card">

        <div class="machine-header">

          <div>
            <p class="eyebrow">
              MACHINE ${id}
            </p>

            <h3>
              Machine ${id}
            </h3>
          </div>

          <div class="status-badge">
            ${icon} ${health.status}
          </div>

        </div>

        <div class="machine-readings">

          <div>
            <span>Temperature</span>
            <strong>
              ${fmt(reading.temp, 1)}°C
            </strong>
          </div>

          <div>
            <span>Vibration</span>
            <strong>
              ${fmt(reading.vib, 2)} g
            </strong>
          </div>

          <div>
            <span>Current</span>
            <strong>
              ${fmt(reading.current, 2)} A
            </strong>
          </div>

          <div>
            <span>RPM</span>
            <strong>
              ${Math.round(reading.rpm)}
            </strong>
          </div>

        </div>

        <div class="health-score">

          <span>Health Score</span>

          <strong>
            ${fmt(health.score, 1)}%
          </strong>

        </div>

        <div class="deviation">

          Weighted deviation:
          <strong>
            ${fmt(
              health.deviation * 100,
              1
            )}%
          </strong>

        </div>

      </div>
    `;
  }

  container.innerHTML = html;
}


// ============================================================
// CHART CREATION
// ============================================================

function createCharts() {

  if (typeof Chart === "undefined") {

    console.warn(
      "Chart.js not loaded."
    );

    return;
  }

  const commonOptions = {

    responsive: true,

    animation: false,

    plugins: {
      legend: {
        display: true
      }
    },

    scales: {
      x: {
        display: true
      },

      y: {
        beginAtZero: false
      }
    }
  };


  const tempCanvas =
    document.getElementById(
      "chart-temp"
    );

  const vibCanvas =
    document.getElementById(
      "chart-vib"
    );

  const curCanvas =
    document.getElementById(
      "chart-cur"
    );

  const rpmCanvas =
    document.getElementById(
      "chart-rpm"
    );


  if (tempCanvas) {

    charts.temp =
      new Chart(
        tempCanvas,
        {
          type: "line",

          data: {
            labels: [],

            datasets: [
              createDataset(
                "Machine 1"
              ),

              createDataset(
                "Machine 2"
              ),

              createDataset(
                "Machine 3"
              )
            ]
          },

          options: commonOptions
        }
      );
  }


  if (vibCanvas) {

    charts.vib =
      new Chart(
        vibCanvas,
        {
          type: "line",

          data: {
            labels: [],

            datasets: [
              createDataset("Machine 1"),
              createDataset("Machine 2"),
              createDataset("Machine 3")
            ]
          },

          options: commonOptions
        }
      );
  }


  if (curCanvas) {

    charts.cur =
      new Chart(
        curCanvas,
        {
          type: "line",

          data: {
            labels: [],

            datasets: [
              createDataset("Machine 1"),
              createDataset("Machine 2"),
              createDataset("Machine 3")
            ]
          },

          options: commonOptions
        }
      );
  }


  if (rpmCanvas) {

    charts.rpm =
      new Chart(
        rpmCanvas,
        {
          type: "line",

          data: {
            labels: [],

            datasets: [
              createDataset("Machine 1"),
              createDataset("Machine 2"),
              createDataset("Machine 3")
            ]
          },

          options: commonOptions
        }
      );
  }
}


function createDataset(label) {

  return {
    label,

    data: [],

    borderWidth: 2,

    pointRadius: 0,

    tension: 0.25
  };
}


// ============================================================
// UPDATE LIVE CHARTS
// ============================================================

function updateCharts() {

  const time =
    new Date().toLocaleTimeString();

  const chartsToUpdate = [
    charts.temp,
    charts.vib,
    charts.cur,
    charts.rpm
  ];

  chartsToUpdate.forEach(chart => {

    if (!chart) return;

    chart.data.labels.push(time);

    if (chart.data.labels.length > 30) {
      chart.data.labels.shift();
    }
  });


  if (charts.temp) {

    for (let i = 1; i <= 3; i++) {

      if (latestData[i]) {

        charts.temp.data.datasets[i - 1]
          .data.push(
            latestData[i].temp
          );

        if (
          charts.temp.data.datasets[i - 1]
            .data.length > 30
        ) {
          charts.temp.data.datasets[i - 1]
            .data.shift();
        }
      }
    }

    charts.temp.update();
  }


  if (charts.vib) {

    for (let i = 1; i <= 3; i++) {

      if (latestData[i]) {

        charts.vib.data.datasets[i - 1]
          .data.push(
            latestData[i].vib
          );

        if (
          charts.vib.data.datasets[i - 1]
            .data.length > 30
        ) {
          charts.vib.data.datasets[i - 1]
            .data.shift();
        }
      }
    }

    charts.vib.update();
  }


  if (charts.cur) {

    for (let i = 1; i <= 3; i++) {

      if (latestData[i]) {

        charts.cur.data.datasets[i - 1]
          .data.push(
            latestData[i].current
          );

        if (
          charts.cur.data.datasets[i - 1]
            .data.length > 30
        ) {
          charts.cur.data.datasets[i - 1]
            .data.shift();
        }
      }
    }

    charts.cur.update();
  }


  if (charts.rpm) {

    for (let i = 1; i <= 3; i++) {

      if (latestData[i]) {

        charts.rpm.data.datasets[i - 1]
          .data.push(
            latestData[i].rpm
          );

        if (
          charts.rpm.data.datasets[i - 1]
            .data.length > 30
        ) {
          charts.rpm.data.datasets[i - 1]
            .data.shift();
        }
      }
    }

    charts.rpm.update();
  }
}


// ============================================================
// DIGITAL FINGERPRINT
// ============================================================

function renderFingerprint() {

  const container =
    document.getElementById(
      "fingerprint-cards"
    );

  if (!container) return;

  let html = "";

  for (let id = 1; id <= 3; id++) {

    const reading =
      latestData[id];

    if (!reading) continue;

    const health =
      getHealth(reading);

    html += `
      <div class="card fingerprint-card">

        <p class="eyebrow">
          MACHINE ${id}
        </p>

        <h3>
          Digital Fingerprint
        </h3>

        <div class="fingerprint-status">
          ${health.status}
        </div>

        <div class="fingerprint-row">

          <span>Temperature</span>

          <span>
            ${fmt(reading.temp, 1)}°C
            /
            ${BASELINE.temp}°C
          </span>

        </div>

        <div class="fingerprint-row">

          <span>Vibration</span>

          <span>
            ${fmt(reading.vib, 2)}g
            /
            ${BASELINE.vib}g
          </span>

        </div>

        <div class="fingerprint-row">

          <span>Current</span>

          <span>
            ${fmt(reading.current, 2)}A
            /
            ${BASELINE.current}A
          </span>

        </div>

        <div class="fingerprint-row">

          <span>RPM</span>

          <span>
            ${Math.round(reading.rpm)}
            /
            ${BASELINE.rpm}
          </span>

        </div>

        <div class="deviation">

          Weighted deviation:
          <strong>
            ${fmt(
              health.deviation * 100,
              1
            )}%
          </strong>

        </div>

      </div>
    `;
  }

  container.innerHTML = html;
}


// ============================================================
// ALERTS
// ============================================================

function renderAlerts() {

  const container =
    document.getElementById(
      "alert-log"
    );

  if (!container) return;

  let html = "";

  for (let id = 1; id <= 3; id++) {

    const reading =
      latestData[id];

    if (!reading) continue;

    const health =
      getHealth(reading);

    if (health.status === "GOOD") {

      html += `
        <div class="alert good">
          <strong>
            🟢 Machine ${id}
          </strong>

          <span>
            Operating within normal
            fingerprint range.
          </span>
        </div>
      `;
    }

    else if (health.status === "AVERAGE") {

      html += `
        <div class="alert warning">

          <strong>
            🟡 Machine ${id}
          </strong>

          <span>
            Moderate deviation detected.
            Monitor the machine.
          </span>

          <small>
            Deviation:
            ${fmt(
              health.deviation * 100,
              1
            )}%
          </small>

        </div>
      `;
    }

    else {

      html += `
        <div class="alert critical">

          <strong>
            🔴 Machine ${id}
          </strong>

          <span>
            High deviation detected.
            Machine inspection recommended.
          </span>

          <small>
            RPM:
            ${Math.round(reading.rpm)}
            vs baseline
            ${BASELINE.rpm}
          </small>

        </div>
      `;
    }
  }

  container.innerHTML = html;
}


// ============================================================
// REPORT
// ============================================================

function renderReport() {

  const body =
    document.getElementById(
      "report-body"
    );

  if (!body) return;

  let html = "";

  for (let id = 1; id <= 3; id++) {

    const reading =
      latestData[id];

    if (!reading) continue;

    const health =
      getHealth(reading);

    html += `
      <tr>

        <td>
          Machine ${id}
        </td>

        <td class="num">
          ${fmt(reading.temp, 1)}°C
        </td>

        <td class="num">
          ${fmt(reading.temp, 1)}°C
        </td>

        <td class="num">
          ${fmt(reading.vib, 2)}g
        </td>

        <td class="num">
          ${fmt(reading.current, 2)}A
        </td>

        <td class="num">
          ${Math.round(reading.rpm)}
        </td>

        <td>
          ${health.status}
        </td>

      </tr>
    `;
  }

  body.innerHTML = html;
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  const tabs =
    document.querySelectorAll(
      "#tabs button"
    );

  tabs.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const view =
          button.dataset.view;

        showView(view);

      }
    );
  });
}


function showView(view) {

  document
    .querySelectorAll(".view")
    .forEach(section => {

      section.classList.remove(
        "active"
      );
    });


  document
    .querySelectorAll("#tabs button")
    .forEach(button => {

      button.classList.remove(
        "active"
      );
    });


  const section =
    document.getElementById(
      `view-${view}`
    );

  if (section) {

    section.classList.add(
      "active"
    );
  }


  const button =
    document.querySelector(
      `#tabs button[data-view="${view}"]`
    );

  if (button) {

    button.classList.add(
      "active"
    );
  }
}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

  const now =
    new Date();

  const clock =
    document.getElementById(
      "clock"
    );

  const date =
    document.getElementById(
      "clockdate"
    );

  if (clock) {

    clock.textContent =
      now.toLocaleTimeString();
  }

  if (date) {

    date.textContent =
      now.toLocaleDateString(
        undefined,
        {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric"
        }
      );
  }
}


// ============================================================
// MAIN UPDATE
// ============================================================

async function updateSystem() {

  // Generate simulated readings
  // and send them to Node backend.

  for (
    let machineId = 1;
    machineId <= 3;
    machineId++
  ) {

    const reading =
      readSensors(machineId);

    await sendReading(reading);
  }


  // Read back from backend

  const data =
    await getLatest();


  if (!data) return;


  renderDashboard();

  renderFingerprint();

  renderAlerts();

  renderReport();

  updateCharts();
}


// ============================================================
// START
// ============================================================

async function startApp() {

  console.log(
    "Factory Fingerprint DNA started."
  );

  console.log(
    "Backend:",
    API_BASE
  );


  setupNavigation();

  updateClock();

  setInterval(
    updateClock,
    1000
  );


  createCharts();

  await updateSystem();


  setInterval(
    updateSystem,
    2000
  );
}


// ============================================================
// START AFTER PAGE LOAD
// ============================================================

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    startApp
  );

}
else {

  startApp();
}