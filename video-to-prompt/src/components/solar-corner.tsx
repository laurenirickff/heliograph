"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Solar corner accent with persistent eclipse behavior in dark mode.
 *
 * - Light mode: sun visible, no moon.
 * - Dark mode: moon covers the sun and remains (eclipse + visible corona).
 * - Transition to dark: moon orbits in along an arc from top-right to cover.
 * - Transition to light: moon departs along the same arc and hides.
 * - Respects reduced motion.
 */
export function SolarCorner() {
  const [darkActive, setDarkActive] = useState(false);
  const [animPhase, setAnimPhase] = useState<"idle" | "in" | "out">("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Anchor global background glow to the sun's center in the viewport
    const updateAnchor = () => {
      try {
        const el = document.querySelector<HTMLElement>(".solar-corner");
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const sunCenterX = rect.left + 120; // sun cx within 240x240 box
        const sunCenterY = rect.top + 120;  // sun cy within 240x240 box
        const root = document.documentElement;
        root.style.setProperty("--solar-anchor-x", `${sunCenterX}px`);
        root.style.setProperty("--solar-anchor-y", `${sunCenterY}px`);
      } catch {}
    };

    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    // In case layout shifts after hydration, run once more on next frame
    const raf = requestAnimationFrame(updateAnchor);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    // Initialize from current theme (avoids FOUC/mismatch)
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    setDarkActive(isDark);

    const onToggle = () => {
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const nowDark = document.documentElement.classList.contains("dark");

      if (prefersReduced) {
        // Jump to final state without animation
        if (nowDark) {
          setDarkActive(true);
        } else {
          setDarkActive(false);
        }
        setAnimPhase("idle");
        return;
      }

      if (nowDark) {
        // Entering dark: prime transition, then move to eclipse position next frame
        setAnimPhase("in");
        requestAnimationFrame(() => {
          setDarkActive(true);
        });
        const id = setTimeout(() => setAnimPhase("idle"), 850);
        return () => clearTimeout(id);
      } else {
        // Leaving dark: move away next frame, then clear anim flag
        setAnimPhase("out");
        requestAnimationFrame(() => {
          setDarkActive(false);
        });
        const id = setTimeout(() => setAnimPhase("idle"), 850);
        return () => clearTimeout(id);
      }
    };

    window.addEventListener("theme-toggle", onToggle as EventListener);
    return () => window.removeEventListener("theme-toggle", onToggle as EventListener);
  }, []);

  return (
    <div
      className={`solar-corner${darkActive ? " dark-active" : ""}${
        animPhase === "in" ? " anim-in" : animPhase === "out" ? " anim-out" : ""
      }`}
      aria-hidden="true"
    >
      {/* Full-viewport solar backdrop anchored to the sun's position via portal to avoid clipping */}
      {mounted && createPortal(<div className="solar-backdrop" />, document.body)}
      <svg width="240" height="240" viewBox="0 0 240 240" className="svg-root">
        <defs>
          {/* Sun */}
          <radialGradient id="sunGlow" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFD278" stopOpacity="0.75" />
            <stop offset="40%" stopColor="#E9B949" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#E9B949" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunCore" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFE5A8" />
            <stop offset="100%" stopColor="#E9B949" />
          </radialGradient>
          {/* Moon */}
          <radialGradient id="moonFillDark" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0F1624" />
            <stop offset="100%" stopColor="#0A0E17" />
          </radialGradient>
          {/* Soft shadow to simulate penumbra on the sun */}
          <filter id="moonShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
            <feOffset dx="1" dy="1" result="off" />
            <feColorMatrix in="off" type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.22 0" />
          </filter>
        </defs>

        {/* Layer 1: Sun backdrop and core (below moon) */}
        <g className="sun">
          <circle className="sun-glow" cx="120" cy="120" r="95" fill="url(#sunGlow)" />
          <circle className="sun-core" cx="120" cy="120" r="52" fill="url(#sunCore)" />
        </g>

        {/* Layer 2: Moon occluder moves along a circular orbit to cover the sun */}
        <g className="moon-group" aria-hidden>
          <g className="moon-orbit">
            <g className="moon-inner" transform="translate(169.71, 0)">
              <circle className="moon" cx="0" cy="0" r="56" filter="url(#moonShadow)" fill="url(#moonFillDark)" />
            </g>
          </g>
        </g>

        {/* Layer 3: Corona ring overlay (visible in dark mode only) */}
        <g className="corona-overlay">
          <circle className="sun-corona" cx="120" cy="120" r="56" fill="none" stroke="#E9B949" strokeOpacity="0.58" strokeWidth="5" />
        </g>
      </svg>

      <style jsx>{`
        .solar-corner {
          position: fixed;
          top: 12px;
          left: 12px;
          width: 240px;
          height: 240px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
          /* Orbit geometry variables (sun at 80,80; orbit center at 0,0) */
          --sun-x: 120px;
          --sun-y: 120px;
          --orbit-r: 169.71px; /* sqrt(120^2 + 120^2) */
          --start-x: 169.71px; /* top-right point on orbit */
          --start-y: 0px;
          --dur: 0.75s;
        }
        /* Backdrop: sits behind content, does not catch events */
        .solar-backdrop {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            radial-gradient(
              farthest-corner circle at var(--solar-anchor-x) var(--solar-anchor-y),
              rgba(184, 131, 31, 0.42) 0%,
              rgba(184, 131, 31, 0.26) 24%,
              rgba(184, 131, 31, 0.12) 52%,
              rgba(184, 131, 31, 0.04) 76%,
              rgba(184, 131, 31, 0) 100%
            ),
            radial-gradient(
              farthest-corner circle at 0% 100%,
              rgba(0, 0, 0, 0) 40%,
              rgba(0, 0, 0, 0.12) 100%
            );
          background-repeat: no-repeat;
          background-attachment: fixed;
        }
        :global(.dark) .solar-backdrop {
          background-image:
            radial-gradient(
              farthest-corner circle at var(--solar-anchor-x) var(--solar-anchor-y),
              rgba(233, 185, 73, 0.55) 0%,
              rgba(233, 185, 73, 0.30) 22%,
              rgba(233, 185, 73, 0.14) 48%,
              rgba(233, 185, 73, 0.05) 72%,
              rgba(233, 185, 73, 0) 100%
            ),
            radial-gradient(
              farthest-corner circle at 0% 100%,
              rgba(0, 0, 0, 0) 30%,
              rgba(0, 0, 0, 0.35) 100%
            );
        }
        .svg-root { display: block; }
        /* Base states */
        /* Remove inner SVG glow ring to avoid visible edge with page backdrop */
        .sun-glow { display: none; }
        .moon-group { opacity: 0; }
        .dark-active .moon-group { opacity: 1; }
        /* Smooth circular motion: rotate the orbit group around (0,0) */
        .moon-orbit {
          transform-origin: 0px 0px;
          transform: rotate(0deg) translateZ(0);
          will-change: transform;
          transition: transform var(--dur) cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dark-active .moon-orbit { transform: rotate(45deg) translateZ(0); }
        .moon-group { transition: opacity var(--dur) ease-in-out; }
        .anim-out .moon-group { opacity: 0; }
        /* Corona ring visible only in dark mode */
        .corona-overlay { opacity: 0; transition: opacity 220ms ease-in-out; }
        :global(.dark) .solar-corner .corona-overlay { opacity: 1; }
        /* Dark mode styling: emphasize corona, use dark moon fill */
        :global(.dark) .solar-corner .sun-core { opacity: 0.12; }
        :global(.dark) .solar-corner .sun-glow { opacity: 0.15; }
        :global(.dark) .solar-corner .sun-corona { opacity: 0.85; }
        :global(.dark) .solar-corner .moon { fill: url(#moonFillDark); }
      `}</style>
    </div>
  );
}


