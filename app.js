// ═══════════════════════════════════════════
// app.js — USIA Campus AR Navigator
// Stack: A-Frame + AR.js (3D labels) + Canvas (arrow) + OSRM (routing)
// ═══════════════════════════════════════════

const scene = document.querySelector("a-scene");
let currentDest = null;
let userPosition = null;
let navInterval = null;
let currentBearing = null;

const placeSelect = document.getElementById("place-select");
const distLabel = document.getElementById("dist-label");
const arrivedMsg = document.getElementById("arrived-msg");
const gpsStatus = document.getElementById("gps-status");

// ═══════════════════════════════════════════
// 1. REAL GPS
// ═══════════════════════════════════════════

if (!navigator.geolocation) {
  gpsStatus.textContent = "❌ GPS not supported";
  gpsStatus.style.color = "#FF2244";
} else {
  gpsStatus.textContent = "📡 Getting your location...";
  gpsStatus.style.color = "#FFD700";

  navigator.geolocation.watchPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      const acc = Math.round(pos.coords.accuracy);
      gpsStatus.textContent = `📍 ${userPosition.lat.toFixed(5)}, ${userPosition.lon.toFixed(5)}  ·  ±${acc}m`;
      gpsStatus.style.color =
        acc < 20 ? "#00FFAA" : acc < 50 ? "#FFD700" : "#FF8800";

      if (currentDest) updateNav();
    },
    (err) => {
      const msg = {
        1: "❌ Location permission denied",
        2: "❌ GPS signal unavailable",
        3: "❌ GPS timed out",
      };
      gpsStatus.textContent = msg[err.code] || "❌ GPS error";
      gpsStatus.style.color = "#FF2244";
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
}

// ═══════════════════════════════════════════
// 2. COMPASS (phone orientation)
// ═══════════════════════════════════════════

let deviceHeading = 0;

window.addEventListener(
  "deviceorientationabsolute",
  (e) => {
    if (e.alpha !== null) deviceHeading = e.alpha;
  },
  true,
);

window.addEventListener("deviceorientation", (e) => {
  if (e.webkitCompassHeading !== undefined) {
    deviceHeading = e.webkitCompassHeading; // iOS
  } else if (e.alpha !== null) {
    deviceHeading = 360 - e.alpha; // Android
  }
});

// iOS 13+ needs explicit permission
document.getElementById("orient-btn").addEventListener("click", () => {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission().then((state) => {
      if (state === "granted") {
        document.getElementById("orient-btn").style.display = "none";
      }
    });
  } else {
    // Android — no permission needed, just hide button
    document.getElementById("orient-btn").style.display = "none";
  }
});

// ═══════════════════════════════════════════
// 3. CANVAS ARROW
// ═══════════════════════════════════════════

const arrowCanvas = document.getElementById("arrow-canvas");
const arrowCtx = arrowCanvas.getContext("2d");
arrowCanvas.width = 160;
arrowCanvas.height = 160;

function drawArrow(bearingToTarget) {
  arrowCtx.clearRect(0, 0, 160, 160);

  // Adjust for where phone is facing
  const adjusted = (bearingToTarget - deviceHeading + 360) % 360;
  const angle = (adjusted * Math.PI) / 180;

  arrowCtx.save();
  arrowCtx.translate(80, 80);
  arrowCtx.rotate(angle);

  // Outer glow ring
  arrowCtx.beginPath();
  arrowCtx.arc(0, 0, 70, 0, Math.PI * 2);
  arrowCtx.strokeStyle = "rgba(0,255,170,0.12)";
  arrowCtx.lineWidth = 14;
  arrowCtx.stroke();

  // Inner ring
  arrowCtx.beginPath();
  arrowCtx.arc(0, 0, 56, 0, Math.PI * 2);
  arrowCtx.strokeStyle = "rgba(0,255,170,0.3)";
  arrowCtx.lineWidth = 2;
  arrowCtx.stroke();

  // Arrow shaft
  arrowCtx.beginPath();
  arrowCtx.moveTo(0, 40);
  arrowCtx.lineTo(0, -30);
  arrowCtx.strokeStyle = "#00FFAA";
  arrowCtx.lineWidth = 7;
  arrowCtx.lineCap = "round";
  arrowCtx.shadowColor = "#00FFAA";
  arrowCtx.shadowBlur = 20;
  arrowCtx.stroke();

  // Arrow head
  arrowCtx.beginPath();
  arrowCtx.moveTo(0, -55);
  arrowCtx.lineTo(-18, -28);
  arrowCtx.lineTo(18, -28);
  arrowCtx.closePath();
  arrowCtx.fillStyle = "#00FFAA";
  arrowCtx.shadowColor = "#00FFAA";
  arrowCtx.shadowBlur = 24;
  arrowCtx.fill();

  // Center dot
  arrowCtx.beginPath();
  arrowCtx.arc(0, 0, 6, 0, Math.PI * 2);
  arrowCtx.fillStyle = "#ffffff";
  arrowCtx.shadowBlur = 0;
  arrowCtx.fill();

  arrowCtx.restore();
}

function clearArrow() {
  arrowCtx.clearRect(0, 0, 160, 160);
}

// Redraw arrow every frame (so it rotates smoothly as phone turns)
function arrowLoop() {
  if (currentBearing !== null && currentDest && userPosition) {
    drawArrow(currentBearing);
  } else {
    clearArrow();
  }
  requestAnimationFrame(arrowLoop);
}
arrowLoop();

// ═══════════════════════════════════════════
// 4. AR ENTITIES (A-Frame + AR.js 3D labels)
// ═══════════════════════════════════════════

function createPlaceEntity(place) {
  const entity = document.createElement("a-entity");
  entity.setAttribute("id", "ar-" + place.id);
  entity.setAttribute(
    "gps-entity-place",
    `latitude: ${place.lat}; longitude: ${place.lon}`,
  );

  // Dark card background
  const plane = document.createElement("a-plane");
  plane.setAttribute("color", "#000000");
  plane.setAttribute("opacity", "0.65");
  plane.setAttribute("width", "4");
  plane.setAttribute("height", "2");
  plane.setAttribute("position", "0 2 0");
  plane.setAttribute("look-at", "[gps-camera]");

  // Place name text
  const text = document.createElement("a-text");
  text.setAttribute("id", "text-" + place.id);
  text.setAttribute("value", place.icon + "  " + place.name);
  text.setAttribute("align", "center");
  text.setAttribute("color", "#00FFAA");
  text.setAttribute("scale", "12 12 12");
  text.setAttribute("position", "0 2 0.1");
  text.setAttribute("look-at", "[gps-camera]");

  // Bouncing cone
  const cone = document.createElement("a-cone");
  cone.setAttribute("id", "cone-" + place.id);
  cone.setAttribute("color", "#00FFAA");
  cone.setAttribute("radius-bottom", "0.4");
  cone.setAttribute("radius-top", "0");
  cone.setAttribute("height", "1");
  cone.setAttribute("position", "0 4 0");
  cone.setAttribute("rotation", "180 0 0");
  cone.setAttribute(
    "animation",
    "property: position; from: 0 4 0; to: 0 5 0; " +
      "dur: 800; dir: alternate; loop: true; easing: easeInOutSine",
  );

  entity.appendChild(plane);
  entity.appendChild(text);
  entity.appendChild(cone);
  entity.addEventListener("click", () => showPopup(place));
  scene.appendChild(entity);
}

scene.addEventListener("loaded", () => {
  for (const key in PLACES) createPlaceEntity(PLACES[key]);
});

// ═══════════════════════════════════════════
// 5. DESTINATION DROPDOWN
// ═══════════════════════════════════════════

for (const key in PLACES) {
  const p = PLACES[key];
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = p.icon + " " + p.name;
  placeSelect.appendChild(opt);
}

placeSelect.addEventListener("change", () => {
  const key = placeSelect.value;
  if (!key) {
    currentDest = null;
    currentBearing = null;
    distLabel.textContent = "Select a destination";
    arrivedMsg.classList.add("hidden");
    resetHighlights();
    clearSteps();
    if (navInterval) {
      clearInterval(navInterval);
      navInterval = null;
    }
    return;
  }
  currentDest = PLACES[key];
  showPopup(currentDest);
  updateNav();
  if (navInterval) clearInterval(navInterval);
  navInterval = setInterval(updateNav, 15000);
});

// ═══════════════════════════════════════════
// 6. UPDATE NAV — GPS → OSRM → Arrow + HUD
// ═══════════════════════════════════════════

async function updateNav() {
  if (!currentDest) return;
  if (!userPosition) {
    distLabel.textContent = "📡 Waiting for GPS fix...";
    return;
  }

  distLabel.textContent = "⏳ Calculating route...";

  const route = await getRoadRoute(
    userPosition.lat,
    userPosition.lon,
    currentDest.lat,
    currentDest.lon,
  );

  highlightEntity(currentDest.id);

  if (hasArrived(route.distance)) {
    currentBearing = null;
    distLabel.textContent = "✅ Arrived at " + currentDest.name;
    arrivedMsg.classList.remove("hidden");
    clearSteps();
    if (navInterval) {
      clearInterval(navInterval);
      navInterval = null;
    }
    return;
  }

  arrivedMsg.classList.add("hidden");

  // ── Set arrow bearing from OSRM next waypoint ──
  if (!route.isFallback && route.coords && route.coords.length > 1) {
    const [lon1, lat1] = route.coords[0];
    const [lon2, lat2] = route.coords[1];
    currentBearing = getBearing(lat1, lon1, lat2, lon2); // next road point
  } else {
    currentBearing = getBearing(
      // straight line fallback
      userPosition.lat,
      userPosition.lon,
      currentDest.lat,
      currentDest.lon,
    );
  }

  // ── HUD text ──
  const distText =
    route.distance < 1000
      ? Math.round(route.distance) + " m"
      : (route.distance / 1000).toFixed(2) + " km";
  const eta = formatDuration(route.duration);
  const mode = route.isFallback ? "📏 direct" : "🛣️ road";

  distLabel.textContent =
    getCardinal(currentBearing) +
    "  ·  " +
    distText +
    " (" +
    mode +
    ")" +
    (eta ? "  ·  🚶 " + eta : "") +
    "  →  " +
    currentDest.name;

  showSteps(route.steps);
}

// ═══════════════════════════════════════════
// 7. HIGHLIGHT AR ENTITY
// ═══════════════════════════════════════════

function highlightEntity(selectedId) {
  for (const key in PLACES) {
    const isSelected = key === selectedId;
    document
      .getElementById("cone-" + key)
      ?.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
    document
      .getElementById("text-" + key)
      ?.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
  }
}

function resetHighlights() {
  for (const key in PLACES) {
    document.getElementById("cone-" + key)?.setAttribute("color", "#00FFAA");
    document.getElementById("text-" + key)?.setAttribute("color", "#00FFAA");
  }
}

// ═══════════════════════════════════════════
// 8. TURN-BY-TURN STEPS
// ═══════════════════════════════════════════

function showSteps(steps) {
  const list = document.getElementById("steps-list");
  const btn = document.getElementById("show-steps-btn");
  if (!list || !steps.length) return;
  list.innerHTML = "";
  steps.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.textContent = i + 1 + ". " + s.instruction + " (" + s.distance + ")";
    list.appendChild(div);
  });
  btn.classList.remove("hidden");
}

function clearSteps() {
  const list = document.getElementById("steps-list");
  if (list) list.innerHTML = "";
  document.getElementById("show-steps-btn")?.classList.add("hidden");
  document.getElementById("steps-panel")?.classList.add("hidden");
}

document.getElementById("show-steps-btn").addEventListener("click", () => {
  document.getElementById("steps-panel").classList.toggle("hidden");
});

document.getElementById("close-steps").addEventListener("click", () => {
  document.getElementById("steps-panel").classList.add("hidden");
});

// ═══════════════════════════════════════════
// 9. INFO POPUP
// ═══════════════════════════════════════════

function showPopup(place) {
  document.getElementById("popup-name").textContent =
    place.icon + " " + place.name;
  document.getElementById("popup-desc").textContent = "📋 " + place.description;
  document.getElementById("popup-hours").textContent = "🕐 " + place.hours;
  document.getElementById("popup-contact").textContent = "📞 " + place.contact;
  document.getElementById("info-popup").classList.remove("hidden");
}

document.getElementById("close-popup").addEventListener("click", () => {
  document.getElementById("info-popup").classList.add("hidden");
});

// ═══════════════════════════════════════════
// 10. EMERGENCY BUTTON
// ═══════════════════════════════════════════

document.getElementById("emergency-btn").addEventListener("click", () => {
  if (!userPosition) {
    alert("📡 GPS not ready. Step outside and wait.");
    return;
  }
  const nearest = getNearestEmergency(userPosition.lat, userPosition.lon);
  if (!nearest) return;

  placeSelect.value = nearest.id;
  currentDest = nearest;
  showPopup(nearest);
  updateNav();

  if (navInterval) clearInterval(navInterval);
  navInterval = setInterval(updateNav, 15000);

  const overlay = document.getElementById("emergency-overlay");
  overlay.style.display = "block";
  setTimeout(() => {
    overlay.style.display = "none";
  }, 4000);

  alert(
    "🚨 EMERGENCY\nRouting to: " +
      nearest.name +
      "\nContact: " +
      nearest.contact,
  );
});
