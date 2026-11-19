"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { Icon } from "./Icon";

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
    setMounted(true);
  }, []);

  const label =
    theme === "light" ? "Karanlık temaya geç" : "Aydınlık temaya geç";

  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition-colors hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
        className,
      )}
      onClick={() => setThemeState(toggleTheme())}
      title={label}
      type="button"
    >
      {mounted ? (
        <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
      ) : (
        <span aria-hidden="true" className="h-[17px] w-[17px]" />
      )}
    </button>
  );
}
