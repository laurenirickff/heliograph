"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Solar corner accent with persistent eclipse behavior in dark mode.
 *
 * - Light mode: sun visible, no moon.
 * - Dark mode: moon covers the sun and remains.
 * - Transition to dark: moon orbits in along an arc from top-right to cover.
 * - Transition to light: moon departs along the same arc and hides.
 * - Respects reduced motion.
 */
export function SolarCorner() {
  const [darkActive, setDarkActive] = useState(false);
  const [animPhase, setAnimPhase] = useState<"idle" | "in" | "out">("idle");
  const [mounted, setMounted] = useState(false);
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const animTimerRef = useRef<number | null>(null);
  const orbitRef = useRef<SVGGElement | null>(null);
  const orbitEndHandlerRef = useRef<((e: TransitionEvent) => void) | null>(null);

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
        const sunCenterX = rect.left + rect.width / 2;
        const sunCenterY = rect.top + rect.height / 2;
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
    const setVar = (name: string, value: string) => {
      if (cornerRef.current) cornerRef.current.style.setProperty(name, value);
    };
    // Snap to initial state without animation
    setVar("--orbit-dur", "0s");
    if (isDark) {
      setVar("--orbit-angle", "45deg");
      setDarkActive(true);
    } else {
      setVar("--orbit-angle", "0deg");
      setDarkActive(false);
    }

    const onToggle = () => {
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const nowDark = document.documentElement.classList.contains("dark");

      if (prefersReduced) {
        // Jump to final state without animation
        const setVar = (name: string, value: string) => {
          if (cornerRef.current) cornerRef.current.style.setProperty(name, value);
        };
        setVar("--orbit-dur", "0s");
        if (nowDark) {
          setVar("--orbit-angle", "45deg");
          setDarkActive(true);
        } else {
          setVar("--orbit-angle", "0deg");
          setDarkActive(false);
        }
        setAnimPhase("idle");
        return;
      }

      // Clear any in-flight animation timer and transition listener
      if (animTimerRef.current !== null) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      if (orbitEndHandlerRef.current) {
        orbitRef.current?.removeEventListener("transitionend", orbitEndHandlerRef.current as EventListener);
        orbitEndHandlerRef.current = null;
      }

      const setVar = (name: string, value: string) => {
        if (cornerRef.current) cornerRef.current.style.setProperty(name, value);
      };

      if (nowDark) {
        // Entering dark: set to an off-screen angle (-30deg) first so the moon
        // starts outside the viewport, then reveal and animate to 45deg.
        setAnimPhase("in");
        setVar("--fade-dur", "0s");
        setVar("--orbit-dur", "0s");
        setVar("--orbit-angle", "-30deg");
        // Make the moon visible on the next frame so the off-screen angle is committed
        requestAnimationFrame(() => {
          setDarkActive(true);
          // 1st frame: enable duration
          setVar("--orbit-dur", "0.5s");
          // Force a reflow to ensure the browser commits the duration change
          // before we change the angle, so the transform transition runs.
          void orbitRef.current?.getBoundingClientRect();
          requestAnimationFrame(() => {
            // 2nd frame: rotate to 45deg (clockwise)
            setVar("--orbit-angle", "45deg");
            // Restore fade duration for subsequent ops
            requestAnimationFrame(() => setVar("--fade-dur", "0.5s"));
          });
        });
        // End of enter animation: clear the in-phase after the orbit duration
        animTimerRef.current = window.setTimeout(() => {
          setAnimPhase("idle");
        }, 550);
      } else {
        // Leaving dark: continue clockwise to left, then hide and reset
        setAnimPhase("out");
        setVar("--orbit-dur", "0.5s");
        setVar("--orbit-angle", "180deg");
        // After transform completes, hide, then reset angle invisibly
        const onOrbitEnd = (e: TransitionEvent) => {
          if (e.propertyName !== "transform") return;
          // Ensure this handler runs once per exit
          orbitRef.current?.removeEventListener("transitionend", onOrbitEnd as EventListener);
          orbitEndHandlerRef.current = null;
          // Keep hidden during reset
          setDarkActive(false);
          // Reset angle without animation while still in anim-out (fully hidden)
          const afterFade = window.setTimeout(() => {
            setVar("--orbit-dur", "0s");
            setVar("--orbit-angle", "0deg");
            // Re-enable duration and leave the out phase on next frame
            requestAnimationFrame(() => {
              setVar("--orbit-dur", "0.5s");
              setAnimPhase("idle");
            });
          }, 520);
          animTimerRef.current = afterFade;
        };
        orbitEndHandlerRef.current = onOrbitEnd;
        orbitRef.current?.addEventListener("transitionend", onOrbitEnd as EventListener, { once: true });
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
      ref={cornerRef}
      aria-hidden="true"
    >
      {/* Full-viewport solar backdrop anchored to the sun's position via portal to avoid clipping */}
      {mounted && createPortal(<div className="solar-backdrop" />, document.body)}
      <svg width="360" height="360" viewBox="0 0 240 240" className="svg-root" style={{ overflow: "visible" }}>
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
          {/* Moon uses a constant umbra tone (matches dark gradient's lightest tone) */}
          {/* Removed bright moving fill; moon remains dark/opaque at all times */}
          {/* Soft shadow to simulate penumbra — merge with SourceGraphic so the moon stays fully opaque */}
          <filter id="moonShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
            <feOffset in="blur" dx="1" dy="1" result="off" />
            <feColorMatrix in="off" type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.22 0" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Layer 1: Sun backdrop and core (below moon) */}
        <g className="sun">
          <circle className="sun-glow" cx="120" cy="120" r="95" fill="url(#sunGlow)" />
          {/* Slightly larger than moon to yield a subtle rim */}
          <circle className="sun-core" cx="120" cy="120" r="57" fill="url(#sunCore)" />
        </g>
        {/* Layer 2: Moon occluder moves along a circular orbit to cover the sun */}
        <g className="moon-group" aria-hidden>
          <g className="moon-orbit" ref={orbitRef}>
            <g className="moon-inner" transform="translate(169.71, 0)" style={{ mixBlendMode: "normal" }}>
              <circle
                className="moon"
                cx="0"
                cy="0"
                r="56"
                shapeRendering="geometricPrecision"
                style={{ fill: "#000000" }}
              />
            </g>
          </g>
        </g>
      </svg>

      <style jsx>{`
        .solar-corner {
          position: fixed;
          top: -60px; /* add a touch more in-page padding */
          left: -60px;
          width: 360px; /* 20% larger than previous 300 */
          height: 360px;
          /* Scale down overall size ~15% without altering internal geometry */
          transform-origin: top left;
          transform: scale(0.85);
          pointer-events: none;
          z-index: 0; /* above page backgrounds; below content wrapper */
          /* Allow the moon to travel beyond the corner without being clipped */
          overflow: visible;
          /* Orbit geometry variables (sun at 80,80; orbit center at 0,0) */
          --sun-x: 120px;
          --sun-y: 120px;
          --orbit-r: 169.71px; /* sqrt(120^2 + 120^2) */
          --start-x: 169.71px; /* top-right point on orbit */
          --start-y: 0px;
          --dur: 2s;
        }
        /* Backdrop: sits behind content, does not catch events */
        .solar-backdrop {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0; /* above body/html background but below content wrapper */
          background-image:
            radial-gradient(
              farthest-corner circle at var(--solar-anchor-x) var(--solar-anchor-y),
              rgba(184, 131, 31, 0.18) 0%,
              rgba(184, 131, 31, 0.10) 10%,
              rgba(184, 131, 31, 0.045) 22%,
              rgba(184, 131, 31, 0.015) 36%,
              rgba(184, 131, 31, 0.004) 52%,
              rgba(184, 131, 31, 0) 100%
            ),
            radial-gradient(
              farthest-corner circle at 0% 100%,
              rgba(0, 0, 0, 0) 40%,
              rgba(122, 96, 56, 0.18) 100%
            );
          background-repeat: no-repeat;
          background-attachment: fixed;
        }
        :global(.dark) .solar-backdrop {
          background-image:
            radial-gradient(
              farthest-corner circle at var(--solar-anchor-x) var(--solar-anchor-y),
              rgba(241, 196, 83, 0.22) 0%,
              rgba(241, 196, 83, 0.12) 12%,
              rgba(241, 196, 83, 0.055) 24%,
              rgba(241, 196, 83, 0.02) 36%,
              rgba(241, 196, 83, 0.006) 52%,
              rgba(233, 185, 73, 0) 100%
            ),
            radial-gradient(
              farthest-corner circle at 0% 100%,
              rgba(0, 0, 0, 0) 28%,
              rgba(6, 9, 14, 0.46) 100%
            );
        }
        .svg-root { display: block; overflow: visible; }
        /* Base states */
        /* Remove inner SVG glow ring to avoid visible edge with page backdrop */
        .sun-glow { display: none; }
        .moon-group { display: none; }
        .dark-active .moon-group { display: block; }
        /* Smooth circular motion: rotate the orbit group around (0,0) */
        .moon-orbit {
          transform-origin: 0px 0px;
          transform: rotate(var(--orbit-angle, 0deg)) translateZ(0);
          will-change: transform;
          /* Smooth orbit: gentle ease-in-out (S-curve) for natural motion */
          transition: transform var(--orbit-dur, 0.5s) cubic-bezier(0.45, 0, 0.55, 1);
        }
        /* No fade — moon remains opaque during motion */
        .moon-group { transition: none; }
        
        /* Keep the sun's core appearance constant across themes */
        .solar-corner .moon { fill: #000000; stroke: #F1C453; stroke-opacity: 0.16; stroke-width: 1px; }
        /* Keep moon opaque/dark at all times (no tonal change during motion) */
        /* Stylized moon surface and rim */
        .moon-crater {
          fill: rgba(255, 255, 255, 0.07);
          stroke: rgba(0, 0, 0, 0.18);
          stroke-width: 0.5px;
        }
        .moon::after { opacity: 0.8; }
        /* During exit, keep showing the moon; it hides only after the orbit completes. */
      `}</style>
    </div>
  );
}


