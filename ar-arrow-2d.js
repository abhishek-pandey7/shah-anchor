// ═══════════════════════════════════════════════════════════════════
// ar-arrow-2d.js — Flat 2D Canvas Arrow
//
// Drop-in alternative to ar-arrow-3d.js.
// To activate: swap script tags in index.html (see README).
// ═══════════════════════════════════════════════════════════════════

(function () {

    // ── Canvas setup ──────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.id = "arrow-2d-canvas";
    canvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 998;
    pointer-events: none;
  `;
    document.body.appendChild(canvas);

    // Hide the old static canvas arrow if present
    const old = document.getElementById("arrow-canvas");
    if (old) old.style.display = "none";

    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Color ─────────────────────────────────────────────────────────
    let arrowHex = "#00FFAA";
    let manualColor = null;

    window.setArrowColor = function (hex) {
        manualColor = hex || null;
        if (hex) arrowHex = hex;
    };

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
        return "#" + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("");
    }

    // ── Draw ──────────────────────────────────────────────────────────
    function drawArrow(angleDeg) {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h * 0.52;
        const s = Math.min(w, h) * 0.14;  // base unit
        const angle = (angleDeg * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // ── Outer soft glow halo ──
        const halo = ctx.createRadialGradient(0, -s * 0.3, s * 0.2, 0, -s * 0.3, s * 1.6);
        halo.addColorStop(0, hexToRgba(arrowHex, 0.18));
        halo.addColorStop(1, hexToRgba(arrowHex, 0));
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.3, s * 1.6, s * 1.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // ── Shadow (depth layer) ──
        ctx.shadowColor = arrowHex;
        ctx.shadowBlur = s * 0.7;

        // ── Arrow shaft ──
        const shaftW = s * 0.38;
        const shaftT = -s * 0.22;   // top (connects to head)
        const shaftB = s * 0.98;   // bottom (tail)
        const radius = shaftW / 2;

        ctx.beginPath();
        // Rounded bottom, straight top
        ctx.moveTo(-shaftW / 2, shaftT);
        ctx.lineTo(shaftW / 2, shaftT);
        ctx.lineTo(shaftW / 2, shaftB - radius);
        ctx.quadraticCurveTo(shaftW / 2, shaftB, 0, shaftB);
        ctx.quadraticCurveTo(-shaftW / 2, shaftB, -shaftW / 2, shaftB - radius);
        ctx.closePath();
        ctx.fillStyle = arrowHex;
        ctx.fill();

        // ── Arrowhead (wide chevron) ──
        const tipY = -s * 1.18;
        const baseY = -s * 0.22;
        const halfW = s * 0.72;
        const notchY = -s * 0.48;  // inner v-notch

        ctx.beginPath();
        ctx.moveTo(0, tipY);
        ctx.lineTo(halfW, baseY);
        ctx.lineTo(s * 0.20, notchY);
        ctx.lineTo(-s * 0.20, notchY);
        ctx.lineTo(-halfW, baseY);
        ctx.closePath();
        ctx.fillStyle = arrowHex;
        ctx.shadowBlur = s * 0.9;
        ctx.fill();

        // ── White highlight glint on head tip ──
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, tipY + s * 0.15, s * 0.08, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fill();

        ctx.restore();
    }

    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ── Global state (mirrors what ar-arrow-3d.js initialises) ────────
    window._arArrowBearing = null;
    window._arArrowVisible = false;

    // Poll app.js globals every 50 ms (same as ar-arrow-3d.js did)
    setInterval(() => {
        window._arArrowBearing =
            typeof currentBearing !== "undefined" ? currentBearing : null;
        window._arArrowVisible =
            typeof currentDest !== "undefined" && currentDest !== null &&
            typeof userPosition !== "undefined" && userPosition !== null &&
            window._arArrowBearing !== null;
    }, 50);

    // ── Animation loop ────────────────────────────────────────────────
    let t = 0;
    function loop() {
        requestAnimationFrame(loop);
        t += 0.016;

        const bearing = window._arArrowBearing;
        const visible = window._arArrowVisible;
        const heading = typeof deviceHeading !== "undefined" ? deviceHeading : 0;

        if (visible && bearing !== null) {
            // Rainbow auto-cycle when no manual color set
            if (!manualColor) {
                const hue = (t * 8) % 360;
                arrowHex = hslToHex(hue, 100, 55);
                if (typeof window._arrowColorSync === "function") {
                    window._arrowColorSync({ getHexString: () => arrowHex.slice(1) });
                }
            }

            const adjusted = (bearing - heading + 360) % 360;
            drawArrow(adjusted);
        } else {
            clearCanvas();
        }
    }

    loop();
    console.log("[AR Arrow 2D] Loaded ✓");

})();
