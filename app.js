// ═══════════════════════════════════════════
// app.js — USIA Campus AR Navigator
// ═══════════════════════════════════════════

// ── State ──
const scene = document.querySelector("a-scene");
let currentDest = null;
let userPosition = null;
let watchId = null;
let navInterval = null;

// ── DOM refs ──
const placeSelect = document.getElementById("place-select");
const distLabel = document.getElementById("dist-label");
const arrivedMsg = document.getElementById("arrived-msg");
const gpsStatus = document.getElementById("gps-status");

// ═══════════════════════════════════════════
// PART 1 — GPS
// ═══════════════════════════════════════════

function startGPS() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = "❌ GPS not supported on this device";
    gpsStatus.style.color = "#FF2244";
    useFallbackPosition();
    return;
  }

  gpsStatus.textContent = "📡 Getting your location...";
  gpsStatus.style.color = "#FFD700";

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };

      const acc = Math.round(pos.coords.accuracy);
      gpsStatus.textContent = `📍 GPS locked · ±${acc}m`;
      gpsStatus.style.color =
        acc < 20 ? "#00FFAA" : acc < 50 ? "#FFD700" : "#FF8800";

      // Trigger nav update on every new GPS fix
      if (currentDest) updateNav();
    },
    (err) => {
      const reasons = {
        1: "❌ Location denied — please allow location access",
        2: "❌ GPS signal unavailable",
        3: "❌ GPS timed out",
      };
      gpsStatus.textContent =
        (reasons[err.code] || "❌ GPS error") + " · using sim position";
      gpsStatus.style.color = "#FF2244";
      useFallbackPosition();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    },
  );
}

function useFallbackPosition() {
  // Fall back to first place so app still works without GPS
  if (!userPosition) {
    userPosition = { lat: PLACES["academic"].lat, lon: PLACES["academic"].lon };
    gpsStatus.textContent += " (simulated)";
  }
}

// ═══════════════════════════════════════════
// PART 2 — AR Entities
// ═══════════════════════════════════════════

function createPlaceEntity(place) {
  const entity = document.createElement("a-entity");
  entity.setAttribute("id", "ar-" + place.id);
  entity.setAttribute(
    "gps-entity-place",
    `latitude: ${place.lat}; longitude: ${place.lon}`,
  );

  // Background plane
  const plane = document.createElement("a-plane");
  plane.setAttribute("color", "#000000");
  plane.setAttribute("opacity", "0.65");
  plane.setAttribute("width", "4");
  plane.setAttribute("height", "2");
  plane.setAttribute("position", "0 2 0");
  plane.setAttribute("look-at", "[gps-camera]");

  // Label text
  const text = document.createElement("a-text");
  text.setAttribute("id", "text-" + place.id);
  text.setAttribute("value", place.icon + "  " + place.name);
  text.setAttribute("align", "center");
  text.setAttribute("color", "#00FFAA");
  text.setAttribute("scale", "12 12 12");
  text.setAttribute("position", "0 2 0.1");
  text.setAttribute("look-at", "[gps-camera]");

  // Bouncing arrow cone above label
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
    "property: position; from: 0 4 0; to: 0 5 0; dur: 800; dir: alternate; loop: true; easing: easeInOutSine",
  );

  entity.appendChild(plane);
  entity.appendChild(text);
  entity.appendChild(cone);

  // Tap entity → show popup
  entity.addEventListener("click", () => showPopup(place));

  scene.appendChild(entity);
}

// Spawn all entities once scene is ready
scene.addEventListener("loaded", () => {
  for (const key in PLACES) {
    createPlaceEntity(PLACES[key]);
  }
});

// ═══════════════════════════════════════════
// PART 3 — Populate Destination Dropdown
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
    distLabel.textContent = "Select a destination";
    arrivedMsg.classList.add("hidden");
    resetHighlights();
    clearSteps();
    stopNavInterval();
    return;
  }
  currentDest = PLACES[key];
  showPopup(currentDest);
  updateNav();
  startNavInterval();
});

// ═══════════════════════════════════════════
// PART 4 — Navigation + OSRM Road Routing
// ═══════════════════════════════════════════

function startNavInterval() {
  stopNavInterval();
  navInterval = setInterval(updateNav, 10000); // re-route every 10s
}

function stopNavInterval() {
  if (navInterval) {
    clearInterval(navInterval);
    navInterval = null;
  }
}

async function updateNav() {
  if (!currentDest) return;

  // Wait for GPS fix
  if (!userPosition) {
    distLabel.textContent = "📡 Waiting for GPS fix...";
    return;
  }

  distLabel.textContent = "⏳ Calculating road route...";

  const route = await getRoadRoute(
    userPosition.lat,
    userPosition.lon,
    currentDest.lat,
    currentDest.lon,
  );

  highlightEntity(currentDest.id);

  if (hasArrived(route.distance)) {
    distLabel.textContent = "📍 You have arrived at " + currentDest.name;
    arrivedMsg.classList.remove("hidden");
    stopNavInterval(); // stop polling once arrived
    clearSteps();
  } else {
    const distText =
      route.distance < 1000
        ? Math.round(route.distance) + " m"
        : (route.distance / 1000).toFixed(1) + " km";
    const eta = formatDuration(route.duration);
    const mode = route.isFallback ? "(direct)" : "(road)";

    distLabel.textContent =
      getCardinal(route.bearing) +
      "  ·  " +
      distText +
      " " +
      mode +
      (eta ? "  ·  🕐 " + eta : "") +
      "  →  " +
      currentDest.name;

    arrivedMsg.classList.add("hidden");
    showSteps(route.steps);
  }
}

// ═══════════════════════════════════════════
// PART 5 — AR Highlight
// ═══════════════════════════════════════════

function highlightEntity(selectedId) {
  for (const key in PLACES) {
    const cone = document.getElementById("cone-" + key);
    const text = document.getElementById("text-" + key);
    const isSelected = key === selectedId;
    cone && cone.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
    text && text.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
  }
}

function resetHighlights() {
  for (const key in PLACES) {
    document.getElementById("cone-" + key)?.setAttribute("color", "#00FFAA");
    document.getElementById("text-" + key)?.setAttribute("color", "#00FFAA");
  }
}

// ═══════════════════════════════════════════
// PART 6 — Turn-by-Turn Steps UI
// ═══════════════════════════════════════════

function showSteps(steps) {
  const list = document.getElementById("steps-list");
  const btn = document.getElementById("show-steps-btn");
  if (!list || !btn) return;

  list.innerHTML = "";
  steps.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.textContent = i + 1 + ". " + s.instruction + "  (" + s.distance + ")";
    list.appendChild(div);
  });
  btn.classList.remove("hidden");
}

function clearSteps() {
  const list = document.getElementById("steps-list");
  const btn = document.getElementById("show-steps-btn");
  if (list) list.innerHTML = "";
  if (btn) btn.classList.add("hidden");
  document.getElementById("steps-panel")?.classList.add("hidden");
}

document.getElementById("show-steps-btn")?.addEventListener("click", () => {
  document.getElementById("steps-panel")?.classList.toggle("hidden");
});

document.getElementById("close-steps")?.addEventListener("click", () => {
  document.getElementById("steps-panel")?.classList.add("hidden");
});

// ═══════════════════════════════════════════
// PART 7 — Info Popup
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
// PART 8 — Emergency Button
// ═══════════════════════════════════════════

document.getElementById("emergency-btn").addEventListener("click", () => {
  if (!userPosition) {
    alert("📡 GPS not ready yet. Please wait for location fix.");
    return;
  }

  const nearest = getNearestEmergency(userPosition.lat, userPosition.lon);
  if (!nearest) return;

  // Auto-select destination
  placeSelect.value = nearest.id;
  currentDest = nearest;

  showPopup(nearest);
  updateNav();
  startNavInterval();

  // Red flash border
  const overlay = document.getElementById("emergency-overlay");
  overlay.style.display = "block";
  setTimeout(() => {
    overlay.style.display = "none";
  }, 4000);

  alert(
    "🚨 EMERGENCY\nNavigating to: " +
      nearest.name +
      "\nContact: " +
      nearest.contact,
  );
});

// ═══════════════════════════════════════════
// INIT — Start GPS on page load
// ═══════════════════════════════════════════

startGPS();
