"use client";

import { useEffect, useRef, useState } from "react";

// Procedural "engraved compass" medallion rendered with WebGPU/TSL — the
// same BUILD WITH INTENT / IDEA→SYSTEM concept as the CSS orbit, rebuilt as
// a shader. Falls back to the CSS medallion (rendered by the caller) when
// WebGPU is unavailable, disabled, or fails to initialize, and when the
// visitor prefers reduced motion — this component renders nothing of its
// own in those cases, letting the caller's fallback markup show through.
export default function WebGPUMedallion({ onSupportChange }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(null); // null = deciding, true/false = decided

  useEffect(() => {
    let cancelled = false;
    let renderer, cleanupFns = [];

    async function boot() {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !("gpu" in navigator) || !canvasRef.current) {
        if (!cancelled) setSupported(false);
        return;
      }

      try {
        const THREE = await import("three/webgpu");
        const {
          uv, time, float, vec3, vec2, color, mix, length, sin,
          smoothstep, fract, abs, oscSine, Fn,
        } = await import("three/tsl");
        // This three build exports the MaterialX-namespaced two-arg atan as
        // mx_atan2, not atan2 — checked directly against the installed
        // package's three/tsl exports rather than assumed from docs.
        const { mx_atan2: atan2 } = await import("three/tsl");

        const canvas = canvasRef.current;
        renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
        await renderer.init();
        if (cancelled) { renderer.dispose(); return; }

        const rect = canvas.parentElement.getBoundingClientRect();
        const size = Math.max(240, Math.min(rect.width, rect.height));
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(size, size, false);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicNodeMaterial({ transparent: true });

        const UMBER = color(0x3c2b20);
        const AMBER = color(0xc47a3f);
        const AMBER_SOFT = color(0xe0a97a);

        // Thin engraved ring at radius `r0`, width `w`, broken into dashes by
        // angle, slowly rotating — the shader analog of one CSS `.orbit`.
        const ring = Fn(([r, r0, w, dashes, speed]) => {
          const d = abs(r.sub(r0));
          const band = smoothstep(w, float(0.0), d);
          const angle = atan2(uv().y.sub(0.5), uv().x.sub(0.5)).add(time.mul(speed));
          const dashPattern = smoothstep(0.18, 0.14, abs(fract(angle.mul(dashes).div(6.2832)).sub(0.5)));
          return band.mul(dashPattern);
        });

        const p = uv().sub(vec2(0.5, 0.5));
        const r = length(p);

        const rings = ring(r, float(0.30), float(0.006), float(10), float(0.05))
          .add(ring(r, float(0.38), float(0.005), float(14), float(-0.035)))
          .add(ring(r, float(0.46), float(0.004), float(18), float(0.025)));

        const core = smoothstep(float(0.17), float(0.15), r);
        const corePulse = oscSine(time.mul(0.6)).mul(0.06).add(0.94);
        const coreGlow = smoothstep(float(0.24), float(0.0), r).mul(0.25);

        const grain = fract(sin(uv().x.mul(9871.2).add(uv().y.mul(1234.5)).add(time.mul(0.02))).mul(43758.5453)).mul(0.035);

        const lineColor = mix(UMBER, AMBER, rings.clamp(0, 1));
        let rgb = mix(vec3(0, 0, 0), lineColor, rings.clamp(0, 1).mul(0.55));
        rgb = mix(rgb, AMBER.mul(corePulse), core);
        rgb = rgb.add(AMBER_SOFT.mul(coreGlow));
        rgb = rgb.add(grain);

        const alpha = rings.clamp(0, 1).mul(0.9).add(core).add(coreGlow).clamp(0, 1);

        material.colorNode = rgb;
        material.opacityNode = alpha;

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        function onResize() {
          const r2 = canvas.parentElement.getBoundingClientRect();
          const s = Math.max(240, Math.min(r2.width, r2.height));
          renderer.setSize(s, s, false);
        }
        window.addEventListener("resize", onResize);
        cleanupFns.push(() => window.removeEventListener("resize", onResize));

        renderer.setAnimationLoop(() => renderer.render(scene, camera));
        cleanupFns.push(() => renderer.setAnimationLoop(null));
        cleanupFns.push(() => { geometry.dispose(); material.dispose(); renderer.dispose(); });

        if (!cancelled) setSupported(true);
      } catch (err) {
        console.warn("WebGPU medallion unavailable, using CSS fallback:", err);
        if (!cancelled) setSupported(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (supported !== null) onSupportChange?.(supported);
  }, [supported, onSupportChange]);

  // The canvas must exist in the DOM before the effect runs (it reads
  // canvasRef.current), so it's always rendered — just hidden until WebGPU
  // is confirmed working, never conditionally mounted on `supported`.
  return <canvas ref={canvasRef} className="medallion-canvas" aria-hidden="true" hidden={supported !== true} />;
}
