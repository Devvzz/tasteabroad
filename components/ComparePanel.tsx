"use client";

import { useEffect, useRef, useState } from "react";
import type { CityMatch, ResolvedSignal } from "@/lib/agent/types";
import { cityGradient, flag, money } from "@/lib/format";

type Picks = { status: "loading" } | { status: "done"; places: { id: string; name: string }[] } | { status: "error" };

interface Props {
  cities: readonly [CityMatch, CityMatch];
  signals: ResolvedSignal[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
}

async function loadPicks(cityId: string, signals: ResolvedSignal[]): Promise<Picks> {
  try {
    const res = await fetch("/api/city-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityId,
        entityIds: signals.filter((s) => s.kind === "entity").map((s) => s.id),
        tagIds: signals.filter((s) => s.kind === "tag").map((s) => s.id),
      }),
    });
    if (!res.ok) return { status: "error" };
    const body = (await res.json()) as { places?: { id: string; name: string }[] };
    return { status: "done", places: body.places ?? [] };
  } catch {
    return { status: "error" };
  }
}

export function ComparePanel({ cities, signals, t, onClose }: Props) {
  const [picks, setPicks] = useState<Record<string, Picks>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    for (const { city } of cities) {
      void loadPicks(city.id, signals).then((p) => !cancelled && setPicks((prev) => ({ ...prev, [city.id]: p })));
    }
    return () => {
      cancelled = true;
    };
  }, [cities, signals]);

  const rows: { label: string; render: (m: CityMatch) => React.ReactNode }[] = [
    { label: t("results.why"), render: (m) => m.why },
    { label: t("results.tuition"), render: (m) => m.city.tuition.label },
    {
      label: t("results.living"),
      render: (m) =>
        m.city.costOfLiving
          ? t("results.range", {
              min: money(m.city.costOfLiving.eurPerMonth.min, "EUR"),
              max: money(m.city.costOfLiving.eurPerMonth.max, "EUR"),
            })
          : t("results.livingMissing"),
    },
    { label: t("results.languages"), render: (m) => m.city.languages.join(", ") },
    { label: t("results.studentLife"), render: (m) => m.city.studentLife.join(" · ") },
    {
      label: t("compare.picks"),
      render: (m) => {
        const p = picks[m.city.id] ?? { status: "loading" };
        if (p.status === "loading") return <span className="text-muted">{t("compare.picksLoading")}</span>;
        if (p.status === "error" || !p.places.length) return <span className="text-muted">{t("compare.picksEmpty")}</span>;
        return (
          <ul className="list-disc space-y-0.5 pl-4">
            {p.places.map((place) => (
              <li key={place.id}>{place.name}</li>
            ))}
          </ul>
        );
      },
    },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label={t("compare.title")} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4">
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-background px-4 py-3">
          <h2 className="text-xl font-semibold">{t("compare.title")}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm">
            {t("compare.close")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {cities.map(({ city, score }) => (
            <div key={city.id} className="rounded-2xl px-3 pb-3 pt-6 text-white" style={{ background: cityGradient(city.id) }}>
              <p className="text-lg font-semibold leading-tight sm:text-2xl">
                {city.name} <span aria-hidden>{flag(city.countryCode)}</span>
              </p>
              <p className="text-xs opacity-90">{city.country}</p>
              <p className="mt-2 inline-block rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-neutral-900">
                {t("results.match", { score })}
              </p>
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-4 text-sm">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</dt>
              <div className="grid grid-cols-2 gap-3">
                {cities.map((m) => (
                  <dd key={m.city.id} className="rounded-xl border border-line bg-card p-3 leading-relaxed">
                    {row.render(m)}
                  </dd>
                ))}
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
