"use client";

import { useState } from "react";
import type { RankingEntry } from "@/lib/agent/types";
import { EUROPE_VIEW, MAP_WIDTH, project, viewBox, WORLD_VIEW, type MapView } from "@/lib/world-map";
import { WORLD_PATH } from "@/lib/world-path";

interface Props {
  ranking: RankingEntry[];
  /** Cities shown as cards get a numbered marker. */
  topIds: string[];
  selectedId?: string;
  onSelect: (id: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const VIEWS = { world: WORLD_VIEW, europe: EUROPE_VIEW } as const;
type ViewKey = keyof typeof VIEWS;

// Marker sizes in world-view units; other views scale them so they look the same size on screen.
const TOP_RADIUS = 11;
const MARKER_GAP = 3;

/** Stronger matches are darker and bigger, so the map reads at a glance without a legend for every shade. */
function strength(score: number): number {
  return Math.max(0.12, (score / 100) ** 1.6);
}

/**
 * Pushes numbered markers apart until they no longer cover each other (Amsterdam, Utrecht and Leuven
 * sit almost on the same spot). Each marker keeps a thin line to its real location.
 */
function spreadMarkers(points: [number, number][], minDistance: number): [number, number][] {
  const moved = points.map(([x, y]) => [x, y] as [number, number]);
  for (let round = 0; round < 60; round++) {
    let overlap = false;
    for (let i = 0; i < moved.length; i++) {
      for (let j = i + 1; j < moved.length; j++) {
        let dx = moved[j][0] - moved[i][0];
        let dy = moved[j][1] - moved[i][1];
        let d = Math.hypot(dx, dy);
        if (d >= minDistance) continue;
        overlap = true;
        // Same spot: pick a direction from the pair's index so the result is stable.
        if (d < 0.01) [dx, dy, d] = [Math.cos(i + j), Math.sin(i + j), 1];
        const push = (minDistance - d) / 2;
        moved[i] = [moved[i][0] - (dx / d) * push, moved[i][1] - (dy / d) * push];
        moved[j] = [moved[j][0] + (dx / d) * push, moved[j][1] + (dy / d) * push];
      }
    }
    if (!overlap) break;
  }
  return moved;
}

export function TasteMap({ ranking, topIds, selectedId, onSelect, t }: Props) {
  const [viewKey, setViewKey] = useState<ViewKey>("world");
  const view: MapView = VIEWS[viewKey];
  // Units per screen pixel grow as the view widens; this keeps markers the same size in every view.
  const unit = view.width / MAP_WIDTH;

  // Weakest first, so the best matches are drawn on top where cities overlap.
  const dots = [...ranking].reverse();
  const top = topIds
    .map((id) => ranking.find((r) => r.id === id))
    .filter((r): r is RankingEntry => Boolean(r))
    .map((r) => ({ entry: r, at: project(r.lat, r.lon) }));
  const markers = spreadMarkers(
    top.map((m) => m.at),
    (2 * TOP_RADIUS + MARKER_GAP) * unit,
  );

  return (
    <section className="space-y-2 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{t("map.title")}</h2>
          <p className="text-sm text-muted">{t("map.hint")}</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium" role="group" aria-label={t("map.zoom")}>
          {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === viewKey}
              onClick={() => setViewKey(key)}
              className={`rounded-md px-2.5 py-1 ${key === viewKey ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
            >
              {t(`map.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={viewBox(view)} className="h-auto w-full" role="img" aria-label={t("map.title")}>
        <path d={WORLD_PATH} fill="var(--line)" />
        {dots.map((r) => {
          if (topIds.includes(r.id)) return null;
          const [x, y] = project(r.lat, r.lon);
          const selected = r.id === selectedId;
          return (
            // Not in the tab order: 105 stops would trap keyboard users, and the city picker below does the same job.
            <g key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer">
              <title>{t("map.dot", { name: r.name, score: r.score, rank: r.rank })}</title>
              {/* A larger invisible circle makes small dots easy to tap on a phone. */}
              <circle cx={x} cy={y} r={16 * unit} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={(4 + 5 * strength(r.score)) * unit}
                fill={r.fits ? "var(--accent)" : "var(--muted)"}
                fillOpacity={r.fits ? strength(r.score) : 0.25}
                stroke={selected ? "var(--foreground)" : "var(--card)"}
                strokeWidth={(selected ? 3 : 1) * unit}
              />
            </g>
          );
        })}
        {top.map(({ entry, at }, i) => {
          const [x, y] = markers[i];
          const selected = entry.id === selectedId;
          const moved = Math.hypot(x - at[0], y - at[1]) > TOP_RADIUS * unit * 0.3;
          return (
            <g key={entry.id} onClick={() => onSelect(entry.id)} className="cursor-pointer">
              <title>{t("map.dot", { name: entry.name, score: entry.score, rank: entry.rank })}</title>
              {moved && (
                <>
                  <line x1={at[0]} y1={at[1]} x2={x} y2={y} stroke="var(--accent)" strokeWidth={1.5 * unit} />
                  <circle cx={at[0]} cy={at[1]} r={2.5 * unit} fill="var(--accent)" />
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={TOP_RADIUS * unit}
                fill="var(--accent)"
                stroke={selected ? "var(--foreground)" : "var(--card)"}
                strokeWidth={(selected ? 3 : 1.5) * unit}
              />
              <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={13 * unit} fontWeight={700} fill="var(--card)">
                {i + 1}
              </text>
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
