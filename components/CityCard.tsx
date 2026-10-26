"use client";

import type { CityMatch } from "@/lib/agent/types";
import { cityGradient, flag, money } from "@/lib/format";

interface Props {
  match: CityMatch;
  rank: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Languages the student said they can study in (may be empty). */
  studyLanguages: string[];
  comparing: boolean;
  compareDisabled: boolean;
  onCompareToggle: () => void;
}

export function CityCard({ match, rank, t, studyLanguages, comparing, compareDisabled, onCompareToggle }: Props) {
  const { city, score } = match;
  const cost = city.costOfLiving;
  const wanted = new Set(studyLanguages.map((l) => l.toLowerCase()));
  const studyMatches = city.languages.filter((l) => wanted.has(l.toLowerCase()));

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${comparing ? "border-accent ring-2 ring-accent" : "border-line"}`}
    >
      <header
        className="flex items-end justify-between gap-3 px-4 pb-3 pt-8 text-white"
        style={{ background: cityGradient(city.id) }}
      >
        <div>
          <p className="text-xs font-medium opacity-80">#{rank}</p>
          <h3 className="text-2xl font-semibold leading-tight">
            {city.name} <span aria-hidden>{flag(city.countryCode)}</span>
          </h3>
          <p className="text-sm opacity-90">{city.country}</p>
        </div>
        <div className="text-right">
          <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-neutral-900">
            {t("results.match", { score })}
          </p>
          <p className="mt-1 text-[11px] font-medium opacity-90">{t("results.scoreBy")}</p>
        </div>
      </header>

      <div className="space-y-4 p-4 text-sm">
        <section>
          <h4 className="mb-1 font-semibold">{t("results.why")}</h4>
          <p className="leading-relaxed">{match.why}</p>
          {city.qlooProxy && <p className="mt-1 text-xs text-muted">{t("results.proxy", { proxy: city.qlooProxy.name })}</p>}
        </section>

        {match.breakdown.length > 0 && (
          <section>
            <h4 className="mb-2 font-semibold">{t("results.breakdown")}</h4>
            <ul className="space-y-1.5">
              {match.breakdown.map((b) => {
                // Bar length: 100% for rank 1, close to 0 for the last city.
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
          </section>
        )}

        <section>
          <h4 className="mb-1 font-semibold">{t("results.universities")}</h4>
          <ul className="space-y-1">
            {city.universities.map((u) => (
              <li key={u.url}>
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                  {u.name}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl bg-accent-soft p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("results.tuition")}</h4>
            <p className="mt-1 font-medium">{city.tuition.label}</p>
            {city.tuition.note && <p className="mt-1 text-xs text-muted">{city.tuition.note}</p>}
          </section>
          <section className="rounded-xl bg-accent-soft p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("results.living")}</h4>
            {cost ? (
              <p className="mt-1 font-medium">
                {t("results.range", { min: money(cost.eurPerMonth.min, "EUR"), max: money(cost.eurPerMonth.max, "EUR") })}
                <span className="block text-xs font-normal text-muted">
                  {t("results.range", { min: money(cost.usdPerMonth.min, "USD"), max: money(cost.usdPerMonth.max, "USD") })}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-muted">{t("results.livingMissing")}</p>
            )}
          </section>
        </div>

        <section>
          <h4 className="mb-1 font-semibold">{t("results.studentLife")}</h4>
          <p className="leading-relaxed">{match.studentLife}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {city.studentLife.map((tag) => (
              <li key={tag} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                {tag}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="mb-1 font-semibold">{t("results.languages")}</h4>
          {studyMatches.length > 0 && (
            <p className="mb-2 font-medium text-accent">
              ✓ {t("results.studyHere", { langs: studyMatches.join(", ") })}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {city.languages.map((l) => (
              <li
                key={l}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  wanted.has(l.toLowerCase()) ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-muted"
                }`}
              >
                {l}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted">{t("results.estimate")}</p>

        <label
          className={`flex w-fit items-center gap-2 rounded-lg border px-3 py-2 font-medium ${
            comparing ? "border-accent bg-accent-soft text-accent" : "border-line"
          } ${compareDisabled ? "opacity-50" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            checked={comparing}
            disabled={compareDisabled}
            onChange={onCompareToggle}
            className="size-4 accent-[var(--accent)]"
          />
          {t("compare.select")}
        </label>
      </div>
    </article>
  );
}
