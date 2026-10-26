"use client";

import { useState } from "react";

// Every idea here was checked against Qloo: each one ranks the cities differently, from all over the world.
// Ideas Qloo has no city data for (coffee, hiking, K-pop and the like) are left out so a tap always counts,
// and so are ones whose top cities would puzzle a student (Qloo puts Taylor Swift fans in Singapore first).
const IDEAS: Record<string, string[]> = {
  Artists: [
    "Dua Lipa", "Bad Bunny", "BTS", "BLACKPINK", "Burna Boy", "Tyla", "Rosalía", "Shakira",
    "Anitta", "Arctic Monkeys", "Hozier", "Stromae", "Aya Nakamura", "Arijit Singh", "Drake", "Billie Eilish",
  ],
  "Music genres": [
    "techno", "house", "jazz", "reggaeton", "salsa", "bossa nova", "Afrobeats", "afro house",
    "metal", "punk", "indie rock", "hip-hop", "flamenco", "fado", "J-pop", "opera",
  ],
  "Film & TV": [
    "Studio Ghibli", "anime", "Attack on Titan", "One Piece", "Money Heist", "Lupin", "Dark", "Peaky Blinders",
    "Breaking Bad", "Game of Thrones", "Bridgerton", "Barbie", "Stranger Things", "The Office", "Pixar",
  ],
  Food: ["street food", "sushi", "ramen", "tapas", "pizza", "seafood", "Korean BBQ", "craft beer"],
  "Brands & teams": ["Manchester United", "Red Bull", "Patagonia", "Adidas", "Zara", "Uniqlo", "Lego"],
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
