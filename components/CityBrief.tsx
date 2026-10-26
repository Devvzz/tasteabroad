"use client";

import type { RankingEntry } from "@/lib/agent/types";
import { flag, money } from "@/lib/format";
import { FundingInfo } from "./FundingInfo";
import { TasteBars } from "./TasteBars";

interface Props {
  entry: RankingEntry;
  /** How many cities were ranked, for "#12 of 105". */
  of: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** A short summary of any city's place in the ranking: score, per-taste ranks and costs. */
export function CityBrief({ entry, of, t }: Props) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold leading-tight">
            {entry.name} <span aria-hidden>{flag(entry.countryCode)}</span>
          </p>
          <p className="text-muted">
            {entry.country} · {t("results.rankOverall", { rank: entry.rank, of })}
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-accent px-3 py-1 font-semibold text-white">{t("results.match", { score: entry.score })}</p>
      </div>

      {!entry.fits && <p className="rounded-lg bg-warn-soft px-2 py-1 text-xs">{t("checker.outside")}</p>}

      {entry.breakdown.length > 0 && (
        <TasteBars breakdown={entry.breakdown} t={t} className="space-y-1" />
      )}

      <dl className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-accent-soft p-2.5">
          <dt className="text-xs text-muted">{t("results.tuition")}</dt>
          <dd className="font-medium">{entry.tuitionLabel}</dd>
        </div>
        <div className="rounded-xl bg-accent-soft p-2.5">
          <dt className="text-xs text-muted">{t("results.living")}</dt>
          <dd className="font-medium">
            {entry.monthlyUsd
              ? t("results.range", { min: money(entry.monthlyUsd.min, "USD"), max: money(entry.monthlyUsd.max, "USD") })
              : t("results.livingMissing")}
          </dd>
        </div>
        <div className="rounded-xl bg-accent-soft p-2.5">
          <dt className="text-xs text-muted">{t("results.yearly")}</dt>
          <dd className="font-medium">{entry.yearlyUsd !== undefined ? t("results.from", { cost: money(entry.yearlyUsd, "USD") }) : "?"}</dd>
        </div>
      </dl>

      {entry.universities.length > 0 && (
        <p className="text-xs">
          {entry.universities.map((u, i) => (
            <span key={u.url}>
              {i > 0 && " · "}
              <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                {u.name}
              </a>
            </span>
          ))}
        </p>
      )}

      <FundingInfo countryCode={entry.countryCode} t={t} />
    </div>
  );
}
