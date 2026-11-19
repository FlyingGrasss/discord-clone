export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "meydan-theme";

/**
 * Runs before first paint so the stored preference wins over the dark default.
 * Kept framework-free and tiny so it can be inlined in the document head.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("meydan-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}var r=document.documentElement;r.classList.toggle("light",t==="light");r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private modes; the class above still applies.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
