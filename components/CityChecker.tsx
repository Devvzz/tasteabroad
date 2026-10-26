"use client";

import { useState } from "react";
import type { RankingEntry } from "@/lib/agent/types";
import { CityBrief } from "./CityBrief";

interface Props {
  ranking: RankingEntry[];
  /** Cities already shown as cards, so the picker starts on the first one that is not. */
  shownIds: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Lets the student look up where any city lands for their tastes, not only the top five. */
export function CityChecker({ ranking, shownIds, selectedId, onSelect, t }: Props) {
  const [fallbackId] = useState(() => ranking.find((r) => !shownIds.includes(r.id))?.id ?? ranking[0]?.id);
  const entry = ranking.find((r) => r.id === (selectedId ?? fallbackId));
  const byName = [...ranking].sort((a, b) => a.name.localeCompare(b.name));
  if (!entry) return null;

  return (
    <section id="check-city" className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div>
        <h2 className="font-semibold">{t("checker.title")}</h2>
        <p className="text-sm text-muted">{t("checker.hint", { count: ranking.length })}</p>
      </div>
      <label className="sr-only" htmlFor="city-checker">
        {t("checker.title")}
      </label>
      <select
        id="city-checker"
        value={entry.id}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm"
      >
        {byName.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}, {r.country} (#{r.rank})
          </option>
        ))}
      </select>
      <CityBrief entry={entry} of={ranking.length} t={t} />
    </section>
  );
}
