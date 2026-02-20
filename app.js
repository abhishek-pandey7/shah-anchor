// ═══════════════════════════════════════════
// app.js — USIA Campus AR Navigator v2
// ═══════════════════════════════════════════

// ── User profile state ──
let userProfile = { name: "Navigator", age: null };

// ── Navigation state ──
const scene = document.getElementById("ar-scene");
let currentDest = null;
let userPosition = null;
let navInterval = null;
let currentBearing = null;
let arrowColor = "#00FFAA";

// ═══════════════════════════════════════════
// LANDING PAGE LOGIC
// ═══════════════════════════════════════════

const landingPage = document.getElementById("landing-page");
const mainApp = document.getElementById("main-app");
const arScene = document.getElementById("ar-scene");

document.getElementById("start-btn").addEventListener("click", () => {
  const nameVal = document.getElementById("input-name").value.trim();
  const ageVal = document.getElementById("input-age").value.trim();

  if (!nameVal) {
    document.getElementById("input-name").focus();
    document.getElementById("input-name").style.borderColor = "#FF4757";
    setTimeout(() => {
      document.getElementById("input-name").style.borderColor = "";
    }, 1500);
    return;
  }

  userProfile.name = nameVal;
  userProfile.age = ageVal ? parseInt(ageVal) : null;

  // Save to localStorage
  localStorage.setItem("usia_profile", JSON.stringify(userProfile));

  // Update header chip
  updateHeaderChip();

  // Hide landing, show app & AR scene
  landingPage.classList.remove("active");
  landingPage.classList.add("hidden");

  mainApp.style.display = "flex";
  arScene.style.display = "block";

  // Init GPS after user gesture (important for mobile)
  initGPS();
});

// Try to load saved profile
const savedProfile = localStorage.getItem("usia_profile");
if (savedProfile) {
  try {
    userProfile = JSON.parse(savedProfile);
    if (userProfile.name) {
      document.getElementById("input-name").value = userProfile.name;
    }
    if (userProfile.age) {
      document.getElementById("input-age").value = userProfile.age;
    }
  } catch (e) { }
}

function updateHeaderChip() {
  const chip = document.getElementById("header-name-chip");
  const firstName = userProfile.name.split(" ")[0];
  chip.textContent = firstName.length > 8 ? firstName.slice(0, 7) + "…" : firstName;
}

// ═══════════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════════

function openPage(pageId) {
  // Hide main app (but keep AR running)
  mainApp.style.display = "none";

  const page = document.getElementById(pageId);
  page.classList.remove("hidden");
  page.classList.add("active");

  // Populate profile page if needed
  if (pageId === "profile-page") populateProfilePage();
}

function closePage(pageId) {
  const page = document.getElementById(pageId);
  page.classList.remove("active");
  page.classList.add("hidden");

  mainApp.style.display = "flex";
}

// Header buttons
document.getElementById("profile-btn").addEventListener("click", () => openPage("profile-page"));
document.getElementById("settings-btn").addEventListener("click", () => openPage("settings-page"));

// Back buttons
document.querySelectorAll(".back-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.back;
    if (target === "main") {
      // close whatever page is open
      document.getElementById("profile-page").classList.remove("active");
      document.getElementById("profile-page").classList.add("hidden");
      document.getElementById("settings-page").classList.remove("active");
      document.getElementById("settings-page").classList.add("hidden");

      mainApp.style.display = "flex";
    }
  });
});

// ═══════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════

function populateProfilePage() {
  document.getElementById("profile-user-name").textContent = userProfile.name || "Navigator";
  document.getElementById("profile-user-age").textContent = userProfile.age ? `Age: ${userProfile.age}` : "Age: —";
  document.getElementById("edit-name").value = userProfile.name || "";
  document.getElementById("edit-age").value = userProfile.age || "";

  // Count destinations
  document.getElementById("stat-destinations").textContent = Object.keys(PLACES).length;

  // Boot 3D model
  init3DModel();
}

document.getElementById("save-profile-btn").addEventListener("click", () => {
  const nameVal = document.getElementById("edit-name").value.trim();
  const ageVal = document.getElementById("edit-age").value.trim();

  if (!nameVal) return;

  userProfile.name = nameVal;
  userProfile.age = ageVal ? parseInt(ageVal) : null;
  localStorage.setItem("usia_profile", JSON.stringify(userProfile));

  document.getElementById("profile-user-name").textContent = userProfile.name;
  document.getElementById("profile-user-age").textContent = userProfile.age ? `Age: ${userProfile.age}` : "Age: —";
  updateHeaderChip();

  const btn = document.getElementById("save-profile-btn");
  btn.textContent = "✅ Saved!";
  setTimeout(() => { btn.textContent = "Save Changes"; }, 1800);
});

// ══════════════════════════════════════════
// 3D MODEL — Three.js Astronaut-style figure
// ══════════════════════════════════════════
let threeRenderer = null;

function init3DModel() {
  const canvas = document.getElementById("profile-3d-canvas");
  if (!canvas || !window.THREE) return;

  // Dispose old renderer if any
  if (threeRenderer) {
    threeRenderer.dispose();
    threeRenderer = null;
  }

  const W = canvas.parentElement.offsetWidth;
  const H = 200;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  threeRenderer = renderer;

  const scene3 = new THREE.Scene();

  const camera3 = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera3.position.set(0, 1.2, 4);
  camera3.lookAt(0, 0.8, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0x334455, 0.8);
  scene3.add(ambient);

  const dirLight = new THREE.DirectionalLight(0x00ffaa, 1.8);
  dirLight.position.set(2, 5, 3);
  dirLight.castShadow = true;
  scene3.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x6366f1, 0.8);
  rimLight.position.set(-3, 2, -2);
  scene3.add(rimLight);

  const pointLight = new THREE.PointLight(0x00ffaa, 1.2, 8);
  pointLight.position.set(0, 2, 2);
  scene3.add(pointLight);

  // --- Build a stylised figure ---
  const mat = new THREE.MeshPhongMaterial({ color: 0x00ffaa, shininess: 80 });
  const matDark = new THREE.MeshPhongMaterial({ color: 0x0f1f1a, shininess: 60 });
  const matWhite = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 40, emissive: 0x334455 });

  const group = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.32, 32, 32);
  const head = new THREE.Mesh(headGeo, matWhite);
  head.position.set(0, 2.1, 0);
  head.castShadow = true;
  group.add(head);

  // Helmet rim
  const helmetGeo = new THREE.TorusGeometry(0.34, 0.04, 16, 60);
  const helmet = new THREE.Mesh(helmetGeo, mat);
  helmet.position.copy(head.position);
  helmet.rotation.x = Math.PI / 2;
  group.add(helmet);

  // Visor glow
  const visorGeo = new THREE.SphereGeometry(0.2, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const visorMat = new THREE.MeshPhongMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.35, shininess: 120, emissive: 0x00ffaa, emissiveIntensity: 0.2 });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 2.05, 0.2);
  visor.rotation.x = -0.3;
  group.add(visor);

  // Body (torso)
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.75, 32);
  const body = new THREE.Mesh(bodyGeo, matDark);
  body.position.set(0, 1.45, 0);
  body.castShadow = true;
  group.add(body);

  // Chest detail
  const chestGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  const chest = new THREE.Mesh(chestGeo, mat);
  chest.position.set(0, 1.5, 0.25);
  group.add(chest);

  // Shoulders
  [-0.35, 0.35].forEach(x => {
    const sGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const s = new THREE.Mesh(sGeo, mat);
    s.position.set(x, 1.75, 0);
    group.add(s);
  });

  // Arms
  [-0.45, 0.45].forEach(x => {
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.55, 16);
    const arm = new THREE.Mesh(armGeo, matDark);
    arm.position.set(x, 1.45, 0);
    arm.rotation.z = x < 0 ? 0.3 : -0.3;
    arm.castShadow = true;
    group.add(arm);
  });

  // Legs
  [-0.15, 0.15].forEach(x => {
    const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.7, 16);
    const leg = new THREE.Mesh(legGeo, matDark);
    leg.position.set(x, 0.77, 0);
    leg.castShadow = true;
    group.add(leg);

    // Boot
    const bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.22);
    const boot = new THREE.Mesh(bootGeo, mat);
    boot.position.set(x, 0.4, 0.04);
    group.add(boot);
  });

  group.position.y = -0.8;
  scene3.add(group);

  // Ground glow disc
  const glowGeo = new THREE.CircleGeometry(0.6, 32);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.4;
  scene3.add(glow);

  // Particles
  const particleGeo = new THREE.BufferGeometry();
  const pCount = 60;
  const positions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 4;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.04, transparent: true, opacity: 0.5 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene3.add(particles);

  // Animate
  let frame3;
  function animate3() {
    frame3 = requestAnimationFrame(animate3);

    // Check if canvas is still in DOM
    if (!document.getElementById("profile-3d-canvas")) {
      cancelAnimationFrame(frame3);
      return;
    }

    group.rotation.y += 0.008;
    particles.rotation.y += 0.002;
    pointLight.position.x = Math.sin(Date.now() * 0.001) * 2;

    // Floating bob
    group.position.y = -0.8 + Math.sin(Date.now() * 0.0015) * 0.06;

    renderer.render(scene3, camera3);
  }
  animate3();
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════

document.getElementById("setting-arrow-color").addEventListener("change", (e) => {
  arrowColor = e.target.value;
});

// ═══════════════════════════════════════════
// GPS INITIALIZATION
// ═══════════════════════════════════════════

const distLabel = document.getElementById("dist-label");
const arrivedMsg = document.getElementById("arrived-msg");
const gpsStatus = document.getElementById("gps-status");
const placeSelect = document.getElementById("place-select");

function initGPS() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = "❌ GPS not supported";
    gpsStatus.style.color = "#FF4757";
    return;
  }

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
      gpsStatus.style.color = acc < 20 ? "#00FFAA" : acc < 50 ? "#FFD700" : "#FF8800";

      if (currentDest) updateNav();
    },
    (err) => {
      const msg = {
        1: "❌ Location permission denied",
        2: "❌ GPS signal unavailable",
        3: "❌ GPS timed out",
      };
      gpsStatus.textContent = msg[err.code] || "❌ GPS error";
      gpsStatus.style.color = "#FF4757";
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

// ═══════════════════════════════════════════
// COMPASS
// ═══════════════════════════════════════════

let deviceHeading = 0;

window.addEventListener("deviceorientationabsolute", (e) => {
  if (e.alpha !== null) deviceHeading = e.alpha;
}, true);

window.addEventListener("deviceorientation", (e) => {
  if (e.webkitCompassHeading !== undefined) {
    deviceHeading = e.webkitCompassHeading; // iOS
  } else if (e.alpha !== null) {
    deviceHeading = 360 - e.alpha; // Android
  }
});

document.getElementById("orient-btn").addEventListener("click", () => {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission().then((state) => {
      if (state === "granted") {
        document.getElementById("orient-btn").style.display = "none";
      }
    });
  } else {
    document.getElementById("orient-btn").style.display = "none";
  }
});

// ═══════════════════════════════════════════
// CANVAS ARROW
// ═══════════════════════════════════════════

const arrowCanvas = document.getElementById("arrow-canvas");
const arrowCtx = arrowCanvas.getContext("2d");
arrowCanvas.width = 160;
arrowCanvas.height = 160;

function drawArrow(bearingToTarget) {
  arrowCtx.clearRect(0, 0, 160, 160);

  const adjusted = (bearingToTarget - deviceHeading + 360) % 360;
  const angle = (adjusted * Math.PI) / 180;

  arrowCtx.save();
  arrowCtx.translate(80, 80);
  arrowCtx.rotate(angle);

  // Outer glow ring
  arrowCtx.beginPath();
  arrowCtx.arc(0, 0, 70, 0, Math.PI * 2);
  arrowCtx.strokeStyle = hexToRgba(arrowColor, 0.12);
  arrowCtx.lineWidth = 14;
  arrowCtx.stroke();

  // Inner ring
  arrowCtx.beginPath();
  arrowCtx.arc(0, 0, 56, 0, Math.PI * 2);
  arrowCtx.strokeStyle = hexToRgba(arrowColor, 0.3);
  arrowCtx.lineWidth = 2;
  arrowCtx.stroke();

  // Arrow shaft
  arrowCtx.beginPath();
  arrowCtx.moveTo(0, 40);
  arrowCtx.lineTo(0, -30);
  arrowCtx.strokeStyle = arrowColor;
  arrowCtx.lineWidth = 7;
  arrowCtx.lineCap = "round";
  arrowCtx.shadowColor = arrowColor;
  arrowCtx.shadowBlur = 20;
  arrowCtx.stroke();

  // Arrow head
  arrowCtx.beginPath();
  arrowCtx.moveTo(0, -55);
  arrowCtx.lineTo(-18, -28);
  arrowCtx.lineTo(18, -28);
  arrowCtx.closePath();
  arrowCtx.fillStyle = arrowColor;
  arrowCtx.shadowColor = arrowColor;
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

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
// AR ENTITIES
// ═══════════════════════════════════════════

function createPlaceEntity(place) {
  const entity = document.createElement("a-entity");
  entity.setAttribute("id", "ar-" + place.id);
  entity.setAttribute("gps-entity-place", `latitude: ${place.lat}; longitude: ${place.lon}`);

  const plane = document.createElement("a-plane");
  plane.setAttribute("color", "#000000");
  plane.setAttribute("opacity", "0.65");
  plane.setAttribute("width", "4");
  plane.setAttribute("height", "2");
  plane.setAttribute("position", "0 2 0");
  plane.setAttribute("look-at", "[gps-camera]");

  const text = document.createElement("a-text");
  text.setAttribute("id", "text-" + place.id);
  text.setAttribute("value", place.icon + "  " + place.name);
  text.setAttribute("align", "center");
  text.setAttribute("color", "#00FFAA");
  text.setAttribute("scale", "12 12 12");
  text.setAttribute("position", "0 2 0.1");
  text.setAttribute("look-at", "[gps-camera]");

  const cone = document.createElement("a-cone");
  cone.setAttribute("id", "cone-" + place.id);
  cone.setAttribute("color", "#00FFAA");
  cone.setAttribute("radius-bottom", "0.4");
  cone.setAttribute("radius-top", "0");
  cone.setAttribute("height", "1");
  cone.setAttribute("position", "0 4 0");
  cone.setAttribute("rotation", "180 0 0");
  cone.setAttribute("animation",
    "property: position; from: 0 4 0; to: 0 5 0; dur: 800; dir: alternate; loop: true; easing: easeInOutSine"
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
// DESTINATION DROPDOWN
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
    if (navInterval) { clearInterval(navInterval); navInterval = null; }
    return;
  }
  currentDest = PLACES[key];
  showPopup(currentDest);
  updateNav();
  if (navInterval) clearInterval(navInterval);
  navInterval = setInterval(updateNav, 15000);
});

// ═══════════════════════════════════════════
// UPDATE NAV
// ═══════════════════════════════════════════

async function updateNav() {
  if (!currentDest) return;
  if (!userPosition) {
    distLabel.textContent = "📡 Waiting for GPS fix...";
    return;
  }

  distLabel.textContent = "⏳ Calculating route...";

  const route = await getRoadRoute(
    userPosition.lat, userPosition.lon,
    currentDest.lat, currentDest.lon
  );

  highlightEntity(currentDest.id);

  if (hasArrived(route.distance)) {
    currentBearing = null;
    distLabel.textContent = "✅ Arrived at " + currentDest.name;
    arrivedMsg.classList.remove("hidden");
    clearSteps();
    if (navInterval) { clearInterval(navInterval); navInterval = null; }
    return;
  }

  arrivedMsg.classList.add("hidden");

  if (!route.isFallback && route.coords && route.coords.length > 1) {
    const [lon1, lat1] = route.coords[0];
    const [lon2, lat2] = route.coords[1];
    currentBearing = getBearing(lat1, lon1, lat2, lon2);
  } else {
    currentBearing = getBearing(userPosition.lat, userPosition.lon, currentDest.lat, currentDest.lon);
  }

  const distText = route.distance < 1000
    ? Math.round(route.distance) + " m"
    : (route.distance / 1000).toFixed(2) + " km";
  const eta = formatDuration(route.duration);
  const mode = route.isFallback ? "📏 direct" : "🛣️ road";

  distLabel.textContent =
    getCardinal(currentBearing) + "  ·  " +
    distText + " (" + mode + ")" +
    (eta ? "  ·  🚶 " + eta : "") +
    "  →  " + currentDest.name;

  showSteps(route.steps);
}

// ═══════════════════════════════════════════
// HIGHLIGHT
// ═══════════════════════════════════════════

function highlightEntity(selectedId) {
  for (const key in PLACES) {
    const isSelected = key === selectedId;
    document.getElementById("cone-" + key)?.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
    document.getElementById("text-" + key)?.setAttribute("color", isSelected ? "#FFD700" : "#00FFAA");
  }
}

function resetHighlights() {
  for (const key in PLACES) {
    document.getElementById("cone-" + key)?.setAttribute("color", "#00FFAA");
    document.getElementById("text-" + key)?.setAttribute("color", "#00FFAA");
  }
}

// ═══════════════════════════════════════════
// STEPS PANEL
// ═══════════════════════════════════════════

function showSteps(steps) {
  const list = document.getElementById("steps-list");
  const btn = document.getElementById("show-steps-btn");
  if (!list || !steps.length) return;
  list.innerHTML = "";
  steps.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "step-item";
    div.textContent = (i + 1) + ". " + s.instruction + " (" + s.distance + ")";
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
// INFO POPUP
// ═══════════════════════════════════════════

function showPopup(place) {
  document.getElementById("popup-name").textContent = place.icon + " " + place.name;
  document.getElementById("popup-desc").textContent = "📋 " + place.description;
  document.getElementById("popup-hours").textContent = "🕐 " + place.hours;
  document.getElementById("popup-contact").textContent = "📞 " + place.contact;
  document.getElementById("info-popup").classList.remove("hidden");
}

document.getElementById("close-popup").addEventListener("click", () => {
  document.getElementById("info-popup").classList.add("hidden");
});

// ═══════════════════════════════════════════
// EMERGENCY
// ═══════════════════════════════════════════

document.getElementById("emergency-btn").addEventListener("click", () => {
  if (!userPosition) {
    // Show overlay with "no GPS" message
    showEmergencyOverlay(null);
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

  showEmergencyOverlay(nearest);
});

function showEmergencyOverlay(nearest) {
  const overlay = document.getElementById("emergency-overlay");

  if (!nearest) {
    document.getElementById("emergency-dest-name").textContent = "No GPS signal";
    document.getElementById("emergency-dest-contact").textContent = "Step outside & try again";
  } else {
    document.getElementById("emergency-dest-name").textContent = nearest.icon + " " + nearest.name;
    document.getElementById("emergency-dest-contact").textContent = "📞 " + nearest.contact;
  }

  overlay.classList.remove("hidden");


  setTimeout(() => {
    overlay.classList.add("hidden");
  }, 5000);
}

document.getElementById("emergency-dismiss-btn").addEventListener("click", () => {
  document.getElementById("emergency-overlay").classList.add("hidden");
});