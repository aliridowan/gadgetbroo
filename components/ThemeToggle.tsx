"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting until mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors w-9 h-9 flex items-center justify-center">
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center relative w-9 h-9"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 absolute transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 text-slate-800" />
      <Moon className="h-5 w-5 absolute transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100 text-slate-200" />
    </button>
  );
}
