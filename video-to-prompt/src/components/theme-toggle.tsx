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
      root.classList.add("theme-animating");
      // Remove after 550ms to cover single-frame scheduling jitter
      window.setTimeout(() => root.classList.remove("theme-animating"), 550);
    }

    applyTheme(next);
  };

  return (
    <Button variant="secondary" size="sm" onClick={onToggle} title="Toggle theme">
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}


