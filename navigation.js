// navigation.js — Road-based routing using OSRM (free, no API key)

// ── Straight-line distance (Haversine) — used as fallback ──
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Bearing from point A → B (0–360°) ──
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Cardinal direction label ──
function getCardinal(b) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(b / 45) % 8];
}

// ── Arrived if within 15 meters ──
function hasArrived(dist) {
  return dist < 15;
}

// ── Nearest emergency location ──
function getNearestEmergency(userLat, userLon) {
  let nearest = null,
    minDist = Infinity;
  for (const key in PLACES) {
    if (PLACES[key].isEmergency) {
      const d = getDistance(userLat, userLon, PLACES[key].lat, PLACES[key].lon);
      if (d < minDist) {
        minDist = d;
        nearest = PLACES[key];
      }
    }
  }
  return nearest;
}

// ── OSRM Road Routing (free, no API key) ──
async function getRoadRoute(fromLat, fromLon, toLat, toLon) {
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${fromLon},${fromLat};${toLon},${toLat}` +
    `?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM HTTP error: " + res.status);
    const data = await res.json();

    if (data.code !== "Ok") throw new Error("OSRM code: " + data.code);

    const route = data.routes[0];
    const coords = route.geometry.coordinates;

    // Bearing from first two points of actual road path
    const [lon1, lat1] = coords[0];
    const [lon2, lat2] = coords.length > 1 ? coords[1] : coords[0];
    const bearing = getBearing(lat1, lon1, lat2, lon2);

    // Turn-by-turn steps
    const steps = route.legs[0].steps
      .filter((s) => s.maneuver.type !== "arrive" || s.distance > 0)
      .map((s) => ({
        instruction: formatInstruction(
          s.maneuver.type,
          s.maneuver.modifier,
          s.name,
        ),
        distance:
          s.distance < 1000
            ? Math.round(s.distance) + " m"
            : (s.distance / 1000).toFixed(1) + " km",
      }));

    return {
      distance: route.distance, // road distance in meters
      duration: route.duration, // seconds
      bearing: bearing, // initial direction to face
      steps: steps, // turn-by-turn
      coords: coords, // full path coordinates
    };
  } catch (err) {
    console.warn(
      "Road routing failed, using straight-line fallback:",
      err.message,
    );

    // Fallback: straight line data
    return {
      distance: getDistance(fromLat, fromLon, toLat, toLon),
      duration: null,
      bearing: getBearing(fromLat, fromLon, toLat, toLon),
      steps: [{ instruction: "Head toward destination", distance: "" }],
      coords: [
        [fromLon, fromLat],
        [toLon, toLat],
      ],
      isFallback: true,
    };
  }
}

// ── Format OSRM maneuver into human-readable instruction ──
function formatInstruction(type, modifier, streetName) {
  const name = streetName || "the path";
  const mod = modifier ? modifier.replace(/-/g, " ") : "";

  const map = {
    depart: "🚶 Start on " + name,
    turn: "↪ Turn " + mod + " onto " + name,
    "new name": "➡ Continue onto " + name,
    continue: "⬆ Continue on " + name,
    merge: "🔀 Merge " + mod,
    "on ramp": "↗ Take ramp " + mod,
    "off ramp": "↘ Take exit " + mod,
    fork: "⑂ Keep " + mod + " at fork",
    "end of road": "↩ Turn " + mod + " at end of road",
    roundabout: "🔄 Enter roundabout",
    rotary: "🔄 Enter rotary",
    arrive: "📍 You have arrived",
  };

  return map[type] || "➡ " + (mod ? mod + " on " : "") + name;
}

// ── Format duration nicely ──
function formatDuration(seconds) {
  if (!seconds) return "";
  if (seconds < 60) return Math.round(seconds) + " sec";
  const mins = Math.round(seconds / 60);
  return mins < 60
    ? mins + " min"
    : Math.floor(mins / 60) + "h " + (mins % 60) + "m";
}
