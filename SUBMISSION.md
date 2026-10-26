# TasteAbroad

**Find the university city abroad where you'd actually feel at home.**

- Live demo: https://tasteabroad.vercel.app (no login)
- Code: https://github.com/Devvzz/tasteabroad (MIT licence)

> **The key point: every match score comes straight from Qloo.** The percentage on each city is
> Qloo's own taste-affinity value for that city, shown unchanged (0.93 becomes 93%), and the
> ranking is Qloo's order. The AI never sets or changes a score. It decides which Qloo lookups to
> make and writes the explanations around Qloo's results.

## Inspiration

Every year millions of students pick a city to study abroad by looking at rankings and tuition.
Then many of them feel lost for months, because the city simply doesn't fit them: the music, the
food, the way people spend their evenings. Nobody asks "will I feel at home there?" before
signing up. I wanted a tool that asks exactly that question, for any student from any country.

## What it does

TasteAbroad answers three questions at once:

1. **Will I fit in culturally?** Matched by Qloo from your taste.
2. **Can I study there in a language I speak?** English-taught programmes first, other languages optional.
3. **Can I afford it?** Typical international tuition and the monthly cost of living.

You type what you love: artists, films, shows, food, hobbies, brands or places. For example
"Studio Ghibli, street food, cycling". TasteAbroad then:

1. **Matches you to cities** around the world by taste. A curated list of 105 student cities on
   every continent is scored by Qloo's taste graph, and you get your top 5 with Qloo's match score.
2. **Explains each match** in a few sentences that refer to what you typed ("Kyoto feels like
   stepping into a Studio Ghibli film...").
3. **Shows the practical side**: well-known universities with links, typical international
   tuition, the monthly cost of living as honest ranges, and the languages you can study in.
4. **"People like you also liked..."**: artists, films, TV shows and places that people with the
   same taste enjoy.
5. **Compare two cities** side by side, including places inside each city that people with your
   taste love, straight from Qloo.
6. Works on any phone, and every result is a **shareable link**.

One switch limits results to English-taught programmes; "I also speak..." adds other languages,
which matters because many public universities are free or cheap in the local language (German in
Berlin, Spanish in Mexico City). Optional filters for tuition, budget and region narrow things
further. Nothing is filtered by default, so the match is purely about taste.

## How Qloo powers it

Qloo is the core of the product: without Qloo there is no match. A Gemini agent calls Qloo through
function calling with four tools:

| Tool | Qloo call | Why it fits |
| --- | --- | --- |
| `qloo_search` | `GET /search` and `GET /v2/tags` | Turns free text into Qloo signals. A specific name becomes an **entity** (Dua Lipa, Studio Ghibli); a genre or hobby becomes a **tag** (techno, street food, hiking). The agent picks the right one per input. |
| `qloo_destination_affinity` | `GET /v2/insights`, `filter.type=urn:entity:destination`, `filter.results.entities=<our 105 cities>` | Scores every city in our list by taste affinity, plus Qloo's top destinations worldwide. **These scores are what the user sees.** |
| `qloo_similar` | `GET /v2/insights` with `filter.type` = artist, movie, tv_show, place | Powers "People like you also liked...". |
| `get_city_info` | Our curated `data/cities.json` | Adds universities, tuition, cost of living and teaching languages to the cities Qloo picked. |

While you type, the input suggests matches live from Qloo (`GET /search` and `GET /v2/tags`, ranked
by Qloo popularity), so "tay" offers Taylor Swift and "sush" offers Sushi before the agent even starts.

The compare view makes one more Qloo call per city: `filter.type=urn:entity:place` with
`filter.location` set to the city, so you see places in that city that people with your taste
rate highest (only restaurants, bars, cafés, sights, museums, parks and similar; hotels and trade
fair venues are filtered out).

### Example request (key removed)

For "Studio Ghibli, street food":

```
GET https://hackathon.api.qloo.com/v2/insights
  ?filter.type=urn:entity:destination
  &signal.interests.entities=<Studio Ghibli entity id>
  &signal.interests.tags=urn:tag:cuisine:qloo:street_food
  &filter.results.entities=<105 destination ids from data/cities.json>
X-Api-Key: <hidden>
```

Qloo returns an affinity per city (for example Kyoto 0.97). That number, as a percentage, is the
match score on the card, and Qloo's order is the ranking. The agent then reads the city facts and
writes the explanations.

### Why the AI can't make things up

| | Decides |
| --- | --- |
| **Qloo** | Which cities fit, how strongly, and in what order. Every score is Qloo's value, unchanged. |
| **AI agent** | Which lookups to make, and the wording. The tools only accept IDs that a Qloo search actually returned, and the city list is built from Qloo's response, not from the model's text. |
| **Dataset** | Universities, tuition, costs and teaching languages, marked as estimates with official links. |

Each result page says this in the app too ("Every match score comes straight from Qloo's taste
data, not from the AI"), and each card labels its score "Score from Qloo".

## How I built it

- **Next.js 16 (App Router), TypeScript in strict mode, Tailwind CSS**, deployed on Vercel.
- **Gemini with function calling** through a small OpenAI-compatible client, so the provider can be
  swapped with environment variables.
- **The agent's steps are streamed live** to the page ("Searching your tastes on Qloo...",
  "Matching cities worldwide...") and a full tool-call trace is shown under the results.
- **A typed Qloo client** with timeouts, bounded retries, caching and clear errors.
- **A curated dataset** of 105 cities. A script maps each one to its Qloo destination ID, and a
  check confirms that Qloo can score every single city.

## Challenges

- **Destination results cluster.** The plain worldwide ranking often returns 50 cities from one
  country. Scoring our own city list with `filter.results.entities` solved it: every city scored.
- **Not every city exists in Qloo.** Qloo has no destination for Wellington or Kigali, so they
  were replaced with cities it can score (Christchurch, Kampala). Seoul and Lima are scored
  through a district in the same metro area (Suwon, Miraflores), and the card says so.
- **Free LLM quotas and latency.** Production logs showed some Gemini calls timing out. I measured
  the models and moved the agent to the one that answers in about a second. The app also keeps a
  time budget, and if the AI is unavailable a fixed pipeline calls the same Qloo tools, so users
  always get results with the same Qloo scores.
- **Hobbies vs. names.** "anime" or "street food" match random entities by name. The agent (and the
  fallback) prefer Qloo tags for genre and hobby inputs.

## Accomplishments I'm proud of

- A working end-to-end agent that answers in about 10 to 20 seconds.
- Results that make sense: Bad Bunny and tapas lead to Barcelona, Studio Ghibli to Kyoto,
  Rammstein to Berlin.
- It degrades gracefully in every failure case I could think of.

## What I learned

How taste graphs differ from rankings, how to design tools so an LLM agent stays grounded in real
data, and how much reliability work a "simple" demo needs on free APIs.

## What's next

- Live tuition and cost data from official sources.
- More cities, and smaller university towns.
- More app languages, starting with Albanian and German.

## Limitations

- Qloo scores describe what groups of people with similar tastes enjoy. They are not a prediction
  about one person and say nothing about admission chances, visas or safety.
- Tuition and living costs are rough estimates. Each city links to the official university sites.
- No personal data is collected: only the likes you type are sent to Qloo and Gemini.

## Try it yourself

```bash
git clone https://github.com/Devvzz/tasteabroad.git
cd tasteabroad
npm install
cp .env.example .env.local   # add QLOO_API_KEY and GEMINI_API_KEY
npm run dev
```

## Built with

Qloo Insights API · Google Gemini · Next.js · TypeScript · Tailwind CSS · Vercel
