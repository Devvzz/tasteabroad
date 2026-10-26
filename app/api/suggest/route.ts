// GET /api/suggest?q=dua: autocomplete for the "What do you love?" input, straight from Qloo search.
import { searchEntities, searchTags, type EntityType } from "@/lib/qloo";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const MIN_LENGTH = 2;
const MAX_LENGTH = 40;
const MAX_SUGGESTIONS = 7;

const TYPES: EntityType[] = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:brand",
];
// Hide very obscure matches; Qloo popularity runs from 0 to 1.
const MIN_POPULARITY = 0.5;

const TYPE_LABELS: Record<string, string> = {
  "urn:entity:artist": "Music",
  "urn:entity:movie": "Film",
  "urn:entity:tv_show": "TV show",
  "urn:entity:book": "Book",
  "urn:entity:brand": "Brand",
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_LENGTH || query.length > MAX_LENGTH) return Response.json({ suggestions: [] });
  if (isRateLimited(`suggest:${clientIp(request)}`, RATE_LIMIT)) return Response.json({ suggestions: [] }, { status: 429 });

  try {
    const [entities, tags] = await Promise.all([searchEntities(query, TYPES, 5), searchTags(query, 3)]);
    const items = [
      ...tags.map((t) => ({ name: t.name, label: "Genre / hobby", popularity: t.popularity ?? 0 })),
      ...entities.map((e) => ({ name: e.name, label: TYPE_LABELS[e.type] ?? "Other", popularity: e.popularity ?? 0 })),
    ]
      .filter((s) => s.popularity >= MIN_POPULARITY)
      .sort((a, b) => b.popularity - a.popularity);
    // Tags and entities often share a name ("Techno"); keep the most popular of each.
    const seen = new Set<string>();
    const suggestions = items
      .filter((s) => !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS)
      .map(({ name, label }) => ({ name, label }));
    return Response.json({ suggestions });
  } catch {
    // Autocomplete is a convenience; a Qloo hiccup should never block typing.
    return Response.json({ suggestions: [] });
  }
}
