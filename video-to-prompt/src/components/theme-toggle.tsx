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
      // Configure overlap-based timing and temporarily freeze background gradients
      if (next === "dark") {
        // Light -> Dark: wait for first contact (~240ms), then darken over ~260ms
        const delay = 240;
        const duration = 260;
        root.style.setProperty("--theme-delay", `${delay}ms`);
        root.style.setProperty("--theme-duration", `${duration}ms`);
        root.classList.add("theme-animating", "theme-to-dark");
        // Release gradient freeze at delay, end animating after delay+duration
        window.setTimeout(() => root.classList.remove("theme-to-dark"), delay);
        window.setTimeout(() => root.classList.remove("theme-animating"), delay + duration + 60);
      } else {
        // Dark -> Light: sun reappears quickly (~140ms), lighten over ~250ms
        const delay = 140;
        const duration = 250;
        root.style.setProperty("--theme-delay", `${delay}ms`);
        root.style.setProperty("--theme-duration", `${duration}ms`);
        root.classList.add("theme-animating", "theme-to-light");
        window.setTimeout(() => root.classList.remove("theme-to-light"), delay);
        window.setTimeout(() => root.classList.remove("theme-animating"), delay + duration + 60);
      }
    }

    applyTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      title={theme === "dark" ? "Use light mode" : "Use dark mode"}
      aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
      aria-pressed={theme === "dark"}
      className="relative rounded-full border border-input/60 bg-background/40 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/20 hover:shadow-sm hover:border-accent/50 focus-visible:ring-accent/40"
   >
      <span>{theme === "dark" ? "Use light mode" : "Use dark mode"}</span>
    </Button>
  );
}


