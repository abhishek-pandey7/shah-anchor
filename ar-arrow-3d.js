// ═══════════════════════════════════════════
// ar-arrow-3d.js — Immersive 3D AR Arrow
// Replaces the flat canvas arrow with a Three.js
// perspective-rendered 3D arrow that floats in
// the camera feed like a real AR hologram.
// ═══════════════════════════════════════════

(function () {
  // ── Create Three.js canvas overlay ──────────────────────────────────────
  const threeCanvas = document.createElement("canvas");
  threeCanvas.id = "three-arrow-canvas";
  threeCanvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 998;
    pointer-events: none;
  `;
  document.body.appendChild(threeCanvas);

  // Hide the old 2D canvas arrow
  const old2D = document.getElementById("arrow-canvas");
  if (old2D) old2D.style.display = "none";

  // ── Three.js setup ───────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // transparent background

  const scene3D = new THREE.Scene();

  // Slightly forward-tilted camera to simulate heads-up POV
  const camera3D = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.01,
    100,
  );
  camera3D.position.set(0, 0, 5);
  camera3D.lookAt(0, 0, 0);

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
  });

  // ── Material: glowing hologram (color-swappable) ────────────────────────
  let activeColor = new THREE.Color(0x00ffaa);

  const glowMat = new THREE.MeshStandardMaterial({
    color: activeColor.clone(),
    emissive: activeColor.clone(),
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.92,
    roughness: 0.2,
    metalness: 0.6,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: activeColor.clone(),
    emissive: activeColor.clone(),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.35,
    side: THREE.BackSide,
  });

  // ── Build 3D Arrow Group ─────────────────────────────────────────────────
  const arrowGroup = new THREE.Group();

  // Shaft (cylinder)
  const shaftGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 16);
  const shaft = new THREE.Mesh(shaftGeo, glowMat);
  shaft.position.y = 0.3;
  arrowGroup.add(shaft);

  // Shaft glow rim
  const shaftRimGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.1, 16);
  const shaftRim = new THREE.Mesh(shaftRimGeo, rimMat);
  shaftRim.position.y = 0.3;
  arrowGroup.add(shaftRim);

  // Arrowhead (cone)
  const headGeo = new THREE.ConeGeometry(0.28, 0.55, 16);
  const head = new THREE.Mesh(headGeo, glowMat);
  head.position.y = 1.13;
  arrowGroup.add(head);

  // Arrowhead glow rim
  const headRimGeo = new THREE.ConeGeometry(0.42, 0.62, 16);
  const headRim = new THREE.Mesh(headRimGeo, rimMat);
  headRim.position.y = 1.13;
  arrowGroup.add(headRim);

  // Base ring (ground anchor)
  const ringGeo = new THREE.TorusGeometry(0.38, 0.04, 8, 32);
  const ring = new THREE.Mesh(ringGeo, glowMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.3;
  arrowGroup.add(ring);

  // Outer pulse ring
  const pulseRingGeo = new THREE.TorusGeometry(0.7, 0.025, 8, 48);
  const pulseRingMat = new THREE.MeshStandardMaterial({
    color: activeColor.clone(),
    emissive: activeColor.clone(),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.y = -0.3;
  arrowGroup.add(pulseRing);

  arrowGroup.position.set(0, -0.5, 0); // center-lower in view
  scene3D.add(arrowGroup);

  // ── Lighting ─────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene3D.add(ambient);
  const dirLight = new THREE.DirectionalLight(0x00ffaa, 2.5);
  dirLight.position.set(2, 4, 3);
  scene3D.add(dirLight);
  const backLight = new THREE.PointLight(0x00aaff, 1.5, 20);
  backLight.position.set(-3, 2, -2);
  scene3D.add(backLight);

  // ── Floating scan-line plane (hologram effect) ───────────────────────────
  const scanLineMat = new THREE.MeshBasicMaterial({
    color: activeColor.clone(),
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const scanPlaneGeo = new THREE.PlaneGeometry(1.4, 0.015);
  const scanPlane = new THREE.Mesh(scanPlaneGeo, scanLineMat);
  scanPlane.position.set(0, 0, 0.01);
  arrowGroup.add(scanPlane);

  // ── Shadow / ground projection disc ─────────────────────────────────────
  const shadowGeo = new THREE.CircleGeometry(0.5, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: activeColor.clone(),
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -0.32;
  arrowGroup.add(shadowDisc);

  // ── State exposed globally ───────────────────────────────────────────────
  window._arArrowBearing = null;
  window._arArrowVisible = false;

  // ── Color update function (callable from app.js settings) ────────────────
  // Pass a CSS hex string e.g. "#FF6B6B" or null to resume auto-cycle
  let manualColor = null;

  window.setArrowColor = function (hex) {
    manualColor = hex || null;
    if (hex) applyColor(new THREE.Color(hex));
  };

  function applyColor(c) {
    activeColor.copy(c);
    glowMat.color.copy(c);
    glowMat.emissive.copy(c);
    rimMat.color.copy(c);
    rimMat.emissive.copy(c);
    pulseRingMat.color.copy(c);
    pulseRingMat.emissive.copy(c);
    scanLineMat.color.copy(c);
    shadowMat.color.copy(c);
    dirLight.color.copy(c);
  }

  // ── Animation Loop ───────────────────────────────────────────────────────
  let t = 0;
  const targetQuat = new THREE.Quaternion();
  const currentQuat = new THREE.Quaternion();

  function animate() {
    requestAnimationFrame(animate);
    t += 0.016;

    const bearing = window._arArrowBearing;
    const visible = window._arArrowVisible;
    const heading = typeof deviceHeading !== "undefined" ? deviceHeading : 0;

    if (visible && bearing !== null) {
      arrowGroup.visible = true;

      // ── Horizontal rotation: bearing relative to phone heading ──
      const relAngle = ((bearing - heading + 360) % 360) * (Math.PI / 180);

      // Tilt the arrow in 3D based on direction
      // When pointing ahead (relAngle ≈ 0): tilt back into screen depth
      // When pointing left/right: tilt sideways with perspective lean
      const tiltForward = Math.cos(relAngle) * 0.55; // -0.55 to 0.55 rad
      const tiltSide = Math.sin(relAngle) * 0.45;    // lean left/right

      // Build orientation: Y rotation for compass + XZ tilt for 3D feel
      const euler = new THREE.Euler(
        -0.3 + tiltForward * 0.6,  // pitch (forward/back tilt)
        relAngle,                   // yaw (compass rotation)
        tiltSide * 0.4,             // roll (side lean)
        "YXZ",
      );
      targetQuat.setFromEuler(euler);
      currentQuat.slerp(targetQuat, 0.08); // smooth interpolation
      arrowGroup.quaternion.copy(currentQuat);

      // ── Floating hover bob ──
      arrowGroup.position.y = -0.5 + Math.sin(t * 1.8) * 0.09;

      // ── Pulse ring scale ──
      const pulse = 1 + Math.sin(t * 3.5) * 0.15;
      pulseRing.scale.set(pulse, pulse, 1);
      pulseRingMat.opacity = 0.2 + Math.sin(t * 3.5) * 0.15;

      // ── Scan line sweep up the arrow ──
      scanPlane.position.y = -0.5 + ((t * 0.8) % 1.8);
      scanLineMat.opacity = 0.05 + Math.abs(Math.sin(t * 1.5)) * 0.12;

      // ── Emissive pulse ──
      const em = 1.0 + Math.sin(t * 2.5) * 0.35;
      glowMat.emissiveIntensity = em;
      headRim.material.opacity = 0.2 + Math.sin(t * 2.5) * 0.12;

      // ── Auto color-cycle (hue shift) when no manual color set ──
      if (!manualColor) {
        const hue = (t * 8) % 360;          // full cycle every ~45 s
        const cycled = new THREE.Color().setHSL(hue / 360, 1.0, 0.55);
        applyColor(cycled);
        // Keep 2D canvas arrow in sync
        if (typeof window._arrowColorSync === 'function') window._arrowColorSync(cycled);
      }
    } else {
      // Fade out when no destination
      arrowGroup.visible = false;
    }

    renderer.render(scene3D, camera3D);
  }

  animate();

  // ── Patch app.js globals ─────────────────────────────────────────────────
  // We intercept currentBearing / currentDest writes by polling
  // (avoids modifying app.js)
  setInterval(() => {
    window._arArrowBearing =
      typeof currentBearing !== "undefined" ? currentBearing : null;
    window._arArrowVisible =
      typeof currentDest !== "undefined" &&
      currentDest !== null &&
      typeof userPosition !== "undefined" &&
      userPosition !== null &&
      window._arArrowBearing !== null;
  }, 50);

  console.log("[AR Arrow 3D] Loaded ✓");
})();