import type { TasteRank } from "@/lib/agent/types";

interface Props {
  breakdown: TasteRank[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  className?: string;
}

/** One bar per taste: 100% for rank 1, close to 0 for the last city. */
export function TasteBars({ breakdown, t, className = "space-y-1.5" }: Props) {
  return (
    <ul className={className}>
      {breakdown.map((b) => {
        const strength = b.of > 1 ? 1 - (b.rank - 1) / (b.of - 1) : 1;
        return (
          <li key={b.taste} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
            <span className="truncate font-medium" title={b.taste}>
              {b.taste}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, strength * 100)}%` }} />
            </span>
            <span className="tabular-nums text-muted">{t("results.rankOf", { rank: b.rank, of: b.of })}</span>
          </li>
        );
      })}
    </ul>
  );
}
