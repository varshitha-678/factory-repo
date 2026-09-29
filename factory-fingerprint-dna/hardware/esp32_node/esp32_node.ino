/*
  Factory Fingerprint DNA — ESP32 sensor node (NEXT PHASE, not yet wired to the dashboard)
  ------------------------------------------------------------------------------
  This is an example sketch for ONE machine's sensor node. Flash one ESP32 per
  machine (or multiplex sensors on one ESP32 if all three machines are close
  together), each posting to the same backend with a different machineId.

  Sensors used:
    - DS18B20        : digital temperature probe (OneWire)
    - SW-420         : vibration switch module (digital threshold output)
                        For a real vibration MAGNITUDE (not just threshold),
                        replace this with an ADXL335/MPU6050 accelerometer.
    - ACS712         : analog current sensor (clamps around one supply wire)
    - IR/hall sensor  : one pulse per shaft revolution, used to compute RPM

  This sketch reads all four sensors, prints them to Serial for debugging, and
  POSTs a JSON reading to a backend server every few seconds. It intentionally
  does NOT talk to the website directly — see /backend/server.js, which is the
  piece meant to receive this data and serve it back out to the dashboard.

  Wiring (adjust pins to match your board):
    DS18B20 data   -> GPIO 4   (with 4.7k pull-up to 3.3V)
    SW-420 OUT     -> GPIO 14
    ACS712 OUT     -> GPIO 34  (ADC1, analog-only pin on most ESP32 boards)
    IR sensor OUT  -> GPIO 27  (interrupt pin)

  Libraries needed (Arduino Library Manager):
    - OneWire
    - DallasTemperature
    - WiFi (built-in for ESP32)
    - HTTPClient (built-in for ESP32)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---------- CONFIG ----------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_BACKEND_IP:3000/api/reading"; // see backend/server.js
const int   MACHINE_ID    = 1; // 1, 2 or 3 — matches the dashboard's machine IDs

// ---------- PIN MAP ----------
#define ONE_WIRE_PIN   4
#define VIBRATION_PIN  14
#define CURRENT_PIN    34
#define RPM_PIN        27

// ---------- ACS712 calibration (adjust for your specific module: 5A/20A/30A variants differ) ----------
const float ACS712_MV_PER_AMP = 66.0;   // 66 mV/A for the 30A variant; use 100 for 20A, 185 for 5A
const float ACS712_ZERO_VOLT  = 1650.0; // ~Vcc/2 in mV at 0A, calibrate for your board

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature tempSensor(&oneWire);

volatile unsigned long pulseCount = 0;
unsigned long lastRpmCalc = 0;

void IRAM_ATTR onPulse() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);
  tempSensor.begin();

  pinMode(VIBRATION_PIN, INPUT);
  pinMode(RPM_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RPM_PIN), onPulse, FALLING);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nConnected. IP: " + WiFi.localIP().toString());

  lastRpmCalc = millis();
}

float readTemperature() {
  tempSensor.requestTemperatures();
  return tempSensor.getTempCByIndex(0);
}

// SW-420 gives a digital "vibration detected" pulse above its trip threshold.
// This is a coarse proxy: we count trips over a short window and scale it
// into a rough 0.1–0.9 g-equivalent for compatibility with the dashboard's
// vibration field. Swap in an accelerometer (ADXL335/MPU6050) and compute
// real RMS acceleration for a production-grade reading.
float readVibrationProxy() {
  int trips = 0;
  unsigned long start = millis();
  while (millis() - start < 200) {
    if (digitalRead(VIBRATION_PIN) == HIGH) trips++;
    delay(2);
  }
  float normalized = 0.1 + (trips / 100.0) * 0.8;
  if (normalized > 0.9) normalized = 0.9;
  return normalized;
}

float readCurrent() {
  int raw = analogRead(CURRENT_PIN);           // 0-4095 on ESP32's 12-bit ADC
  float voltage_mV = (raw / 4095.0) * 3300.0;   // ESP32 ADC reference is ~3.3V
  float amps = (voltage_mV - ACS712_ZERO_VOLT) / ACS712_MV_PER_AMP;
  return abs(amps);
}

float readRPM() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastRpmCalc;
  noInterrupts();
  unsigned long count = pulseCount;
  pulseCount = 0;
  interrupts();
  lastRpmCalc = now;
  if (elapsed == 0) return 0;
  // one pulse per revolution assumed — adjust divisor if your sensor/disc
  // produces more than one pulse per revolution
  return (count / (elapsed / 60000.0));
}

void sendReading(float temp, float vib, float current, float rpm) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"machineId\":" + String(MACHINE_ID) + ",";
  payload += "\"temp\":" + String(temp, 2) + ",";
  payload += "\"vib\":" + String(vib, 3) + ",";
  payload += "\"current\":" + String(current, 3) + ",";
  payload += "\"rpm\":" + String(rpm, 0);
  payload += "}";

  int code = http.POST(payload);
  Serial.println("POST -> " + String(code) + " : " + payload);
  http.end();
}

void loop() {
  float temp    = readTemperature();
  float vib     = readVibrationProxy();
  float current = readCurrent();
  float rpm     = readRPM();

  Serial.printf("Machine %d | Temp: %.1fC | Vib: %.2f | Current: %.2fA | RPM: %.0f\n",
                MACHINE_ID, temp, vib, current, rpm);

  sendReading(temp, vib, current, rpm);

  delay(2000); // matches the dashboard's 2-second tick
}
