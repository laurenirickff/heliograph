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
      <svg width="200" height="200" viewBox="0 0 200 200" className="svg-root">
        <defs>
          {/* Sun */}
          <radialGradient id="sunGlow" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFD278" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#E9B949" stopOpacity="0.9" />
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
          <radialGradient id="moonFillLight" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#C9D2E3" />
            <stop offset="100%" stopColor="#A2AEC4" />
          </radialGradient>
          {/* Rim highlight on the sun-facing edge of the moon */}
          <linearGradient id="rim" x1="0" y1="0" x2="160" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="55%" stopColor="#E9B949" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E9B949" stopOpacity="0" />
          </linearGradient>
          {/* Soft shadow to simulate penumbra on the sun */}
          <filter id="moonShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
            <feOffset dx="2" dy="2" result="off" />
            <feColorMatrix in="off" type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.35 0" />
          </filter>
        </defs>

        {/* Sun backdrop and core */}
        <g className="sun">
          <circle className="sun-glow" cx="80" cy="80" r="90" fill="url(#sunGlow)" />
          <circle className="sun-core" cx="80" cy="80" r="50" fill="url(#sunCore)" />
          <circle className="sun-corona" cx="80" cy="80" r="56" fill="none" stroke="#E9B949" strokeOpacity="0.6" strokeWidth="6" />
        </g>

        {/* Moon group sits above the sun and clearly occludes it */}
        <g className="moon-group">
          <circle
            className="moon"
            cx="0" cy="80" r="80"
            filter="url(#moonShadow)"
            fill="url(#moonFillLight)"
          />
          <circle className="rim" cx="0" cy="80" r="80" fill="none" stroke="url(#rim)" strokeWidth="3" />
        </g>
      </svg>

      <style jsx>{`
        .solar-corner {
          position: fixed;
          top: -24px;
          left: -24px;
          width: 200px;
          height: 200px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .svg-root { display: block; }
        /* Animation: moon travels left->right across the sun within the corner */
        .eclipse .moon-group {
          animation: moon-sweep 1.15s ease-in-out both;
          transform: translateX(-60px);
        }
        @keyframes moon-sweep {
          0%   { transform: translateX(-60px); }
          50%  { transform: translateX(80px); }
          100% { transform: translateX(220px); }
        }
        /* Dark mode styling: emphasize corona, use dark moon fill */
        :global(.dark) .solar-corner .sun-core { opacity: 0.12; }
        :global(.dark) .solar-corner .sun-glow { opacity: 0.15; }
        :global(.dark) .solar-corner .sun-corona { opacity: 0.8; }
        :global(.dark) .solar-corner .moon { fill: url(#moonFillDark); }
        :global(.dark) .solar-corner .rim { stroke: url(#rim); }
      `}</style>
    </div>
  );
}


