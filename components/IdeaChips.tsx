"use client";

import { useState } from "react";

// A handpicked mix that works well with Qloo: well-known names plus genres and hobbies.
const IDEAS: Record<string, string[]> = {
  Music: ["Dua Lipa", "Bad Bunny", "Taylor Swift", "BTS", "Arctic Monkeys", "Billie Eilish", "techno", "jazz"],
  "Film & TV": ["Studio Ghibli", "anime", "Stranger Things", "Harry Potter", "Marvel", "La La Land", "K-drama", "The Office"],
  Food: ["street food", "sushi", "tapas", "coffee", "pizza", "ramen", "vegan food", "craft beer"],
  Hobbies: ["hiking", "surfing", "skateboarding", "cycling", "football", "museums", "video games", "photography"],
  "Places & brands": ["Nike", "IKEA", "Apple", "beaches", "mountains", "nightlife", "vintage shopping", "Lego"],
};
const CATEGORIES = Object.keys(IDEAS);

interface Props {
  likes: string[];
  onAdd: (value: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function IdeaChips({ likes, onAdd, t }: Props) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const taken = new Set(likes.map((l) => l.toLowerCase()));

  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">{t("form.suggestions")}</p>
      {/* One row that scrolls sideways on narrow phones instead of wrapping. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${
              c === category ? "bg-foreground text-background" : "text-muted hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {IDEAS[category]
          .filter((idea) => !taken.has(idea.toLowerCase()))
          .map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => onAdd(idea)}
              className="rounded-full border border-line px-3 py-1 hover:border-accent hover:text-accent"
            >
              + {idea}
            </button>
          ))}
      </div>
    </div>
  );
}
