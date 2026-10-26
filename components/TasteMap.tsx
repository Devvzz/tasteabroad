"use client";

import type { RankingEntry } from "@/lib/agent/types";
import { MAP_VIEWBOX, project } from "@/lib/world-map";
import { WORLD_PATH } from "@/lib/world-path";

interface Props {
  ranking: RankingEntry[];
  /** Cities shown as cards get a numbered marker. */
  topIds: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Stronger matches are darker and bigger, so the map reads at a glance without a legend for every shade. */
function strength(score: number): number {
  return Math.max(0.12, (score / 100) ** 1.6);
}

export function TasteMap({ ranking, topIds, selectedId, onSelect, t }: Props) {
  // Weakest first, so the best matches are drawn on top where cities overlap (Europe).
  const dots = [...ranking].reverse();

  return (
    <section className="space-y-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div>
        <h2 className="font-semibold">{t("map.title")}</h2>
        <p className="text-sm text-muted">{t("map.hint")}</p>
      </div>
      <svg viewBox={MAP_VIEWBOX} className="h-auto w-full" role="img" aria-label={t("map.title")}>
        <path d={WORLD_PATH} fill="var(--line)" />
        {dots.map((r) => {
          const [x, y] = project(r.lat, r.lon);
          const top = topIds.indexOf(r.id);
          const selected = r.id === selectedId;
          return (
            <g
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={t("map.dot", { name: r.name, score: r.score, rank: r.rank })}
              onClick={() => onSelect(r.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(r.id)}
              className="cursor-pointer outline-none"
            >
              <title>{t("map.dot", { name: r.name, score: r.score, rank: r.rank })}</title>
              {/* A larger invisible circle makes small dots easy to tap on a phone. */}
              <circle cx={x} cy={y} r={16} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={top >= 0 ? 11 : 4 + 5 * strength(r.score)}
                fill={r.fits ? "var(--accent)" : "var(--muted)"}
                fillOpacity={top >= 0 ? 1 : r.fits ? strength(r.score) : 0.25}
                stroke={selected ? "var(--foreground)" : "var(--card)"}
                strokeWidth={selected ? 3 : 1}
              />
              {top >= 0 && (
                <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--card)">
                  {top + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-accent" aria-hidden /> {t("map.strong")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent opacity-25" aria-hidden /> {t("map.weak")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-muted opacity-40" aria-hidden /> {t("map.outside")}
        </span>
      </p>
    </section>
  );
}
