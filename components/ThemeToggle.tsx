"use client";

import { t } from "@/lib/i18n";

const STORAGE_KEY = "theme";

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

/** Light/dark switch. Which label shows is decided by CSS from data-theme, so there is no flash or hydration mismatch. */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-sm"
    >
      <span className="show-in-light flex items-center gap-1.5">
        <span aria-hidden>☾</span>
        {t("theme.dark")}
      </span>
      <span className="show-in-dark flex items-center gap-1.5">
        <span aria-hidden>☀</span>
        {t("theme.light")}
      </span>
    </button>
  );
}
