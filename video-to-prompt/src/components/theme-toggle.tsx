"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function applyTheme(next: "light" | "dark") {
  const root = document.documentElement;
  if (next === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem("theme", next);
    // notify decorative components
    window.dispatchEvent(new Event("theme-toggle"));
  } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      let initial: "light" | "dark";
      if (stored === "light" || stored === "dark") initial = stored;
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) initial = "dark";
      else initial = "dark"; // default to dark for solar theme
      setTheme(initial);
      applyTheme(initial);
    } catch {
      setTheme("dark");
      applyTheme("dark");
    }
  }, []);

  const onToggle = () => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);

    // Add a temporary class to synchronize global CSS transitions
    const root = document.documentElement;
    if (!prefersReduced) {
      // Configure overlap-based timing
      if (next === "dark") {
        // Light -> Dark: wait for first contact (~240ms), then darken over ~260ms
        root.style.setProperty("--theme-delay", "240ms");
        root.style.setProperty("--theme-duration", "260ms");
        // Lifetime covers delay+duration plus small buffer
        const lifetime = 240 + 260 + 60; // ms
        root.classList.add("theme-animating");
        window.setTimeout(() => root.classList.remove("theme-animating"), lifetime);
      } else {
        // Dark -> Light: sun reappears quickly (~140ms), lighten over ~250ms
        root.style.setProperty("--theme-delay", "140ms");
        root.style.setProperty("--theme-duration", "250ms");
        const lifetime = 140 + 250 + 60; // ms
        root.classList.add("theme-animating");
        window.setTimeout(() => root.classList.remove("theme-animating"), lifetime);
      }
    }

    applyTheme(next);
  };

  return (
    <Button variant="secondary" size="sm" onClick={onToggle} title="Toggle theme">
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}


