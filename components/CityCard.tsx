"use client";

import type { CityMatch } from "@/lib/agent/types";

interface Props {
  match: CityMatch;
  rank: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

/** Country code to flag emoji ("JP" -> 🇯🇵). */
function flag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

/** A stable colour per city, used as the card header instead of a photo. */
function hue(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const money = (n: number, currency: "EUR" | "USD") =>
  new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function CityCard({ match, rank, t }: Props) {
  const { city, score } = match;
  const h = hue(city.id);
  const cost = city.costOfLiving;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <header
        className="flex items-end justify-between gap-3 px-4 pb-3 pt-8 text-white"
        style={{ background: `linear-gradient(135deg, hsl(${h} 55% 38%), hsl(${(h + 40) % 360} 60% 52%))` }}
      >
        <div>
          <p className="text-xs font-medium opacity-80">#{rank}</p>
          <h3 className="text-2xl font-semibold leading-tight">
            {city.name} <span aria-hidden>{flag(city.countryCode)}</span>
          </h3>
          <p className="text-sm opacity-90">{city.country}</p>
        </div>
        <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-neutral-900">
          {t("results.match", { score })}
        </p>
      </header>

      <div className="space-y-4 p-4 text-sm">
        <section>
          <h4 className="mb-1 font-semibold">{t("results.why")}</h4>
          <p className="leading-relaxed">{match.why}</p>
          {city.qlooProxy && <p className="mt-1 text-xs text-muted">{t("results.proxy", { proxy: city.qlooProxy.name })}</p>}
        </section>

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

        <p className="text-xs text-muted">
          {t("results.languages")}: {city.languages.join(", ")} · {t("results.estimate")}
        </p>
      </div>
    </article>
  );
}
