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
        const size = Math.min(w, h) * 0.18;
        const angle = (angleDeg * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.15, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(arrowHex, 0.12);
        ctx.lineWidth = size * 0.22;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(arrowHex, 0.30);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Shaft
        ctx.beginPath();
        ctx.moveTo(0, size * 0.55);
        ctx.lineTo(0, -size * 0.45);
        ctx.strokeStyle = arrowHex;
        ctx.lineWidth = size * 0.12;
        ctx.lineCap = "round";
        ctx.shadowColor = arrowHex;
        ctx.shadowBlur = size * 0.35;
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.88);
        ctx.lineTo(-size * 0.30, -size * 0.44);
        ctx.lineTo(size * 0.30, -size * 0.44);
        ctx.closePath();
        ctx.fillStyle = arrowHex;
        ctx.shadowColor = arrowHex;
        ctx.shadowBlur = size * 0.4;
        ctx.fill();

        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
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
