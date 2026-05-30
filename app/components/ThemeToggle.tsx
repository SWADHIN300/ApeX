"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sol-dex-theme");
    const dark = saved ? saved === "dark" : true;
    setIsDark(dark);
    document.documentElement.className = dark ? "dark" : "light";
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.className = next ? "dark" : "light";
    localStorage.setItem("sol-dex-theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="w-[34px] h-[34px] flex items-center justify-center b-thin bg-bg-l1 text-text-muted hover:text-text-main"
      aria-label="Toggle theme"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
