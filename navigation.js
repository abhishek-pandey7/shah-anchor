// ── Haversine straight-line distance (meters) ──
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

// ── Bearing from A → B in degrees (0–360) ──
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

// ── Arrived within 15 meters ──
function hasArrived(dist) {
  return dist < 15;
}

// ── Nearest emergency place ──
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

// ── OSRM walking route (free, no API key) ──
async function getRoadRoute(fromLat, fromLon, toLat, toLon) {
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${fromLon},${fromLat};${toLon},${toLat}` +
    `?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.code !== "Ok") throw new Error("OSRM: " + data.code);

    const route = data.routes[0];
    const coords = route.geometry.coordinates; // [[lon,lat], [lon,lat], ...]

    // Bearing = direction from current pos → next road waypoint
    const [lon1, lat1] = coords[0];
    const [lon2, lat2] = coords.length > 1 ? coords[1] : coords[0];
    const bearing = getBearing(lat1, lon1, lat2, lon2);

    // Turn-by-turn steps
    const steps = route.legs[0].steps
      .filter((s) => s.distance > 0)
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
      distance: route.distance,
      duration: route.duration,
      bearing,
      steps,
      coords,
      isFallback: false,
    };
  } catch (err) {
    console.warn("OSRM failed, using straight-line:", err.message);
    return {
      distance: getDistance(fromLat, fromLon, toLat, toLon),
      duration: null,
      bearing: getBearing(fromLat, fromLon, toLat, toLon),
      steps: [{ instruction: "🚶 Head toward destination", distance: "" }],
      coords: [
        [fromLon, fromLat],
        [toLon, toLat],
      ],
      isFallback: true,
    };
  }
}

// ── Format OSRM maneuver type → readable text ──
function formatInstruction(type, modifier, streetName) {
  const name = streetName || "the path";
  const mod = modifier ? modifier.replace(/-/g, " ") : "";
  const map = {
    depart: "🚶 Start on " + name,
    turn: "↪ Turn " + mod + " onto " + name,
    "new name": "➡ Continue onto " + name,
    continue: "⬆ Continue on " + name,
    merge: "🔀 Merge " + mod,
    fork: "⑂ Keep " + mod + " at fork",
    "end of road": "↩ Turn " + mod + " at end of road",
    roundabout: "🔄 Enter roundabout",
    arrive: "📍 You have arrived",
  };
  return map[type] || "➡ " + (mod ? mod + " on " : "") + name;
}

// ── Format seconds → walking time ──
function formatDuration(seconds) {
  if (!seconds) return "";
  if (seconds < 60) return Math.round(seconds) + " sec walk";
  const mins = Math.round(seconds / 60);
  return mins < 60
    ? mins + " min walk"
    : Math.floor(mins / 60) + "h " + (mins % 60) + "m walk";
}
