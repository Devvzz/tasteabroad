"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  name: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onAdd: (value: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

/** Text input with live Qloo autocomplete. Enter or a click adds the like. */
export function LikeInput({ value, onChange, onAdd, t }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Ask Qloo once the user pauses typing; drop answers to outdated queries.
  useEffect(() => {
    const query = value.trim();
    // Short input hides the list (see showList), so there is nothing to fetch.
    if (query.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(body.suggestions ?? []);
        setHighlight(-1);
      } catch {
        // Aborted or offline: keep typing working without suggestions.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = (name: string) => {
    onAdd(name);
    setSuggestions([]);
    setOpen(false);
  };

  const showList = open && suggestions.length > 0 && value.trim().length >= MIN_LENGTH;

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          id="like-input"
          role="combobox"
          aria-expanded={showList}
          aria-controls="like-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `like-suggestion-${highlight}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && showList) {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && showList) {
              e.preventDefault();
              setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              choose(showList && highlight >= 0 ? suggestions[highlight].name : value);
            }
          }}
          placeholder={t("form.placeholder")}
          maxLength={60}
          className="w-full rounded-xl border border-line bg-background px-3 py-2"
        />
        {showList && (
          <ul
            id="like-suggestions"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={`${s.name}-${s.label}`}
                id={`like-suggestion-${i}`}
                role="option"
                aria-selected={i === highlight}
                // mousedown fires before the input's blur, so the click still lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  clearTimeout(blurTimer.current);
                  choose(s.name);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                  i === highlight ? "bg-accent-soft" : ""
                }`}
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-xs text-muted">{s.label}</span>
              </li>
            ))}
            <li className="border-t border-line px-3 py-1.5 text-[11px] text-muted">{t("form.suggestFromQloo")}</li>
          </ul>
        )}
      </div>
      <button type="button" onClick={() => value.trim() && choose(value)} className="rounded-xl border border-line px-4 py-2 text-sm font-medium">
        {t("form.add")}
      </button>
    </div>
  );
}
