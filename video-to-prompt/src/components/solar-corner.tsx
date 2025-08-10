"use client";

import { useEffect, useRef, useState } from "react";
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
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const animTimerRef = useRef<number | null>(null);
  const orbitRef = useRef<SVGGElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
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
        orbitRef.current?.removeEventListener("transitionend", orbitEndHandlerRef.current as any);
        orbitEndHandlerRef.current = null;
      }

      const setVar = (name: string, value: string) => {
        if (cornerRef.current) cornerRef.current.style.setProperty(name, value);
      };

      if (nowDark) {
        // Entering dark: snap to right (0deg), make moon visible without fade,
        // then enable duration and rotate to 45deg in a separate frame so the
        // transform transition is guaranteed to fire.
        setAnimPhase("in");
        setVar("--fade-dur", "0s");
        setVar("--orbit-dur", "0s");
        setVar("--orbit-angle", "0deg");
        setDarkActive(true); // ensure visible immediately
        requestAnimationFrame(() => {
          // 1st frame: enable duration
          setVar("--orbit-dur", "0.75s");
          // Force a reflow to ensure the browser commits the duration change
          // before we change the angle, so the transform transition runs.
          void orbitRef.current?.getBoundingClientRect();
          requestAnimationFrame(() => {
            // 2nd frame: rotate to 45deg (clockwise)
            setVar("--orbit-angle", "45deg");
            // Restore fade duration for subsequent ops
            requestAnimationFrame(() => setVar("--fade-dur", "0.75s"));
          });
        });
        // End of enter animation: clear the in-phase after the orbit duration
        animTimerRef.current = window.setTimeout(() => {
          setAnimPhase("idle");
        }, 800);
      } else {
        // Leaving dark: continue clockwise to left, then hide and reset
        setAnimPhase("out");
        setVar("--orbit-dur", "0.75s");
        setVar("--orbit-angle", "180deg");
        // After transform completes, hide, then reset angle invisibly
        const onOrbitEnd = (e: TransitionEvent) => {
          if (e.propertyName !== "transform") return;
          // Ensure this handler runs once per exit
          orbitRef.current?.removeEventListener("transitionend", onOrbitEnd as any);
          orbitEndHandlerRef.current = null;
          // Keep hidden during reset
          setDarkActive(false);
          // Reset angle without animation while still in anim-out (fully hidden)
          const afterFade = window.setTimeout(() => {
            setVar("--orbit-dur", "0s");
            setVar("--orbit-angle", "0deg");
            // Re-enable duration and leave the out phase on next frame
            requestAnimationFrame(() => {
              setVar("--orbit-dur", "0.75s");
              setAnimPhase("idle");
            });
          }, 800);
          animTimerRef.current = afterFade;
        };
        orbitEndHandlerRef.current = onOrbitEnd;
        orbitRef.current?.addEventListener("transitionend", onOrbitEnd as any, { once: true });
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
          {/* Bright/white moon used while the moon is moving (entering/leaving) */}
          <radialGradient id="moonFillLight" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#EEF3FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#D9E2F2" stopOpacity="0.92" />
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
          <g className="moon-orbit" ref={orbitRef}>
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
          transform: rotate(var(--orbit-angle, 0deg)) translateZ(0);
          will-change: transform;
          transition: transform var(--orbit-dur, 0.75s) cubic-bezier(0.22, 1, 0.36, 1);
        }
        .moon-group { transition: opacity var(--fade-dur, 0.75s) ease-in-out; }
        /* Corona ring visible only in dark mode */
        .corona-overlay { opacity: 0; transition: opacity 220ms ease-in-out; }
        :global(.dark) .solar-corner .corona-overlay { opacity: 1; }
        /* Dark mode styling: emphasize corona, use dark moon fill */
        :global(.dark) .solar-corner .sun-core { opacity: 0.12; }
        :global(.dark) .solar-corner .sun-glow { opacity: 0.15; }
        :global(.dark) .solar-corner .sun-corona { opacity: 0.85; }
        :global(.dark) .solar-corner .moon { fill: url(#moonFillDark); stroke: #E9B949; stroke-opacity: 0.18; stroke-width: 1px; }
        /* During motion, render the moon bright/white to contrast the travel
           path and feel illuminated (uses subtle cool tint). */
        .solar-corner.anim-in .moon {
          fill: url(#moonFillLight);
          stroke: #ffffff;
          stroke-opacity: 0.28;
          stroke-width: 1px;
        }
        /* Stylized moon surface and rim */
        .moon-crater {
          fill: rgba(255, 255, 255, 0.07);
          stroke: rgba(0, 0, 0, 0.18);
          stroke-width: 0.5px;
        }
        .moon::after { opacity: 0.8; }
        /* During the exit (light) reset window, keep the moon fully transparent
           so any instant-reset is visually suppressed. */
        .anim-out .moon-group { opacity: 0; }
      `}</style>
    </div>
  );
}


