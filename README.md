# CampusNav 🧭

A browser-based **Augmented Reality campus navigation app** built for SAKEC (Shah & Anchor Kutchhi Engineering College), Chembur, Mumbai. Point your phone camera and follow the glowing arrow to any campus destination.

---

## Features

| Feature | Details |
|---------|---------|
| 📷 **Live Camera Feed** | Rear camera streamed as fullscreen background via `getUserMedia` |
| 🧭 **AR Navigation Arrow** | Glowing directional arrow overlaid on camera feed, rotates with compass |
| 📍 **GPS Routing** | Real road routes via OSRM; falls back to straight-line bearing |
| 🔍 **Destination Search** | Live-filter search overlay; collapses to a floating 🔍 button after selection |
| 🧲 **Live Compass** | Tap 🧭 to show a rotating compass rose with N/E/S/W labels and degree readout |
| 🚨 **Emergency Mode** | One-tap routing to nearest hospital, pharmacy, or police station |
| 🎨 **Arrow Color Picker** | Static colors or 🌈 Rainbow auto-cycle (slow HSL hue shift) |
| 👤 **Profile Page** | Name, age, and a Three.js 3D astronaut avatar |
| ⚙️ **Settings** | GPS accuracy, auto-reroute, AR labels, arrow color, card blur |

---

## Project Structure

```
shah-anchor2/
├── index.html          # App shell, all pages & overlays
├── style.css           # Full dark theme, glassmorphism UI
├── app.js              # Core app logic (GPS, compass, routing, UI)
├── navigation.js       # Haversine distance, bearing, OSRM routing
├── locations.js        # All POI definitions (name, coords, emergency flag)
├── ar-arrow-2d.js      # ✅ ACTIVE — flat canvas 2D directional arrow
├── ar-arrow-3d.js      # 💤 STANDBY — Three.js 3D hologram arrow
└── README.md
```

### Switching Arrow Mode

In `index.html`, swap the two commented lines:

```html
<!-- 2D flat arrow (currently active) -->
<script src="ar-arrow-2d.js"></script>

<!-- 3D hologram arrow (swap to activate) -->
<!-- <script src="ar-arrow-3d.js"></script> -->
```

---

## Running Locally

**Requirements:** Node.js, `serve`, `ngrok` (for HTTPS on mobile — camera requires HTTPS)

```bash
# Install serve globally (once)
npm install -g serve

# Serve the project
serve .

# In a separate terminal — expose via HTTPS for mobile camera access
ngrok http 3000
```

Open the **ngrok HTTPS URL** on your phone browser (camera won't work over plain `http://`).

---

## Permissions Required

| Permission | Why |
|-----------|-----|
| **Camera** | Live video feed background |
| **Location (GPS)** | Calculate distance & bearing to destination |
| **Device Orientation** | Compass heading for rotating the arrow (iOS needs explicit tap to grant) |

---

## Adding / Editing Destinations

All locations live in `locations.js`. Add a new entry following this shape:

```js
your_key: {
  id: 'your_key',
  name: 'Place Name',
  icon: '🏢',
  lat: 19.0484,
  lon: 72.9116,
  description: 'Short description',
  hours: '9AM – 6PM',
  contact: '+91 XXXXX XXXXX',
  isEmergency: false   // set true to include in emergency routing
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Camera & AR overlay | `navigator.mediaDevices.getUserMedia` + HTML Canvas |
| 3D Arrow (standby) | [Three.js r128](https://threejs.org/) |
| GPS AR entities | [A-Frame 1.4](https://aframe.io/) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/) |
| Road Routing | [OSRM Public API](http://router.project-osrm.org/) |
| Fonts | [Inter — Google Fonts](https://fonts.google.com/specimen/Inter) |
| Hosting (dev) | `serve` + `ngrok` |

---

## Known Limitations

- **iOS compass** requires the user to tap 🧭 to trigger `DeviceOrientationEvent.requestPermission()`
- **GPS accuracy** outdoors is ~5–20 m; indoors GPS may not lock
- **OSRM routing** requires internet; offline falls back to straight-line bearing
- Camera + GPS + orientation all need **HTTPS** — use ngrok or deploy to a secure host

---

## License

MIT — built for SAKEC campus by the project team.
