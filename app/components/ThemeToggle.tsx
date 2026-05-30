"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sol-dex-theme");
    const dark =
      saved === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : saved
        ? saved === "dark"
        : true;
    setIsDark(dark);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(dark ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next ? "dark" : "light");
    localStorage.setItem("sol-dex-theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="w-[34px] h-[34px] flex items-center justify-center b-thin bg-bg-l1 text-text-muted hover:text-text-main"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
