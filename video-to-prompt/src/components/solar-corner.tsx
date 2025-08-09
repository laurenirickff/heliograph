"use client";

import { useEffect, useState } from "react";

/**
 * Decorative solar accent for the top-left corner:
 * - Light mode: subtle sun with glow
 * - Dark mode: eclipsed sun (corona ring)
 * - On theme toggle: animate a moon disk sweeping across the sun
 */
export function SolarCorner() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const onToggle = () => {
      // Respect reduced motion
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) return;
      setPlay(true);
      const id = setTimeout(() => setPlay(false), 1200);
      return () => clearTimeout(id);
    };
    window.addEventListener("theme-toggle", onToggle as EventListener);
    return () => window.removeEventListener("theme-toggle", onToggle as EventListener);
  }, []);

  return (
    <div className={`solar-corner ${play ? "eclipse" : ""}`} aria-hidden="true">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="sunGlow" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFD278" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#E9B949" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E9B949" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunCore" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFE5A8" />
            <stop offset="100%" stopColor="#E9B949" />
          </radialGradient>
          <radialGradient id="moonShade" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0A0E17" />
            <stop offset="100%" stopColor="#0A0E17" />
          </radialGradient>
        </defs>
        {/* Glow (visible mostly in light mode) */}
        <circle className="sun-glow" cx="80" cy="80" r="90" fill="url(#sunGlow)" />
        {/* Sun core */}
        <circle className="sun-core" cx="80" cy="80" r="50" fill="url(#sunCore)" />
        {/* Corona ring for dark mode */}
        <circle className="sun-corona" cx="80" cy="80" r="56" fill="none" stroke="#E9B949" strokeOpacity="0.6" strokeWidth="6" />
      </svg>
      {/* Moon disk used during animation */}
      <div className="moon" />
      <style jsx>{`
        .solar-corner {
          position: fixed;
          top: -24px;
          left: -24px;
          width: 200px;
          height: 200px;
          pointer-events: none;
          z-index: 0;
        }
        .solar-corner .moon {
          position: absolute;
          top: 40px;
          left: -200px; /* start off-screen left */
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: radial-gradient(60% 60% at 50% 50%, #0A0E17 0%, #0A0E17 100%);
          opacity: 0.98;
          filter: drop-shadow(0 0 12px rgba(0,0,0,0.35));
        }
        .solar-corner.eclipse .moon {
          animation: eclipse-move 1.1s ease-in-out both;
        }
        @keyframes eclipse-move {
          0% { transform: translateX(0); }
          50% { transform: translateX(220px); }
          100% { transform: translateX(440px); }
        }
        /* Mode-specific visibility */
        :global(.dark) .solar-corner .sun-core { opacity: 0.12; }
        :global(.dark) .solar-corner .sun-glow { opacity: 0.15; }
        :global(.dark) .solar-corner .sun-corona { opacity: 0.8; }
        :global(.dark) .solar-corner .moon { background: radial-gradient(60% 60% at 50% 50%, #0F1624 0%, #0A0E17 100%); }
      `}</style>
    </div>
  );
}


