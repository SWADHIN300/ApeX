"use client";

import { useEffect } from "react";
import { useLocalStorageState, useSystemDarkTheme } from "@/hooks/useLocalStorageState";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useLocalStorageState<"dark" | "light" | "system">(
    "sol-dex-theme",
    "dark",
    (value) => value === "light" || value === "system" ? value : "dark",
    (value) => value
  );
  const systemIsDark = useSystemDarkTheme();
  const isDark = theme === "system" ? systemIsDark : theme === "dark";

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = () => {
    const next = !isDark;
    setTheme(next ? "dark" : "light");
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
