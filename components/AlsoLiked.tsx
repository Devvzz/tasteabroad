"use client";

import type { AlsoLikedItem } from "@/lib/agent/types";

interface Props {
  items: AlsoLikedItem[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function AlsoLiked({ items, t }: Props) {
  if (!items.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-lg font-semibold">{t("alsoLiked.title")}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
            {item.imageUrl ? (
              // Qloo image URLs come from many hosts, so a plain img avoids per-host config.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" loading="lazy" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">★</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="text-xs text-muted">{t(`alsoLiked.types.${item.type}`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
