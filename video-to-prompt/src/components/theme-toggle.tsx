"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function applyTheme(next: "light" | "dark") {
  const root = document.documentElement;
  if (next === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem("theme", next);
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
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <Button variant="secondary" size="sm" onClick={onToggle} title="Toggle theme">
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}


