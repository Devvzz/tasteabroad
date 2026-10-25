# TasteAbroad

**Find the university city abroad where you'd actually feel at home.**

- Live demo: https://tasteabroad.vercel.app (no login)
- Code: https://github.com/Devvzz/tasteabroad (MIT licence)

## Inspiration

Every year millions of students pick a city to study abroad by looking at rankings and tuition.
Then many of them feel lost for months, because the city simply doesn't fit them: the music, the
food, the way people spend their evenings. Nobody asks "will I feel at home there?" before
signing up. I wanted a tool that asks exactly that question, for any student from any country.

## What it does

You type what you love: artists, films, shows, food, hobbies, brands or places. For example
"Studio Ghibli, street food, cycling". TasteAbroad then:

1. **Matches you to cities** around the world by taste. 67 student cities on every continent are
   scored by Qloo's taste graph, and you get your top 5 with a match score.
2. **Explains each match** in a few sentences that refer to what you typed ("Kyoto feels like
   stepping into a Studio Ghibli film...").
3. **Shows the practical side**: well-known universities with links, typical international
   tuition and the monthly cost of living as honest ranges.
4. **"People like you also liked..."**: artists, films, TV shows and places that people with the
   same taste enjoy.
5. **Compare two cities** side by side, including places inside each city that people with your
   taste love, straight from Qloo.
6. Works in **English, Albanian and German** (the AI writes in the chosen language), on any phone,
   and every result is a **shareable link**.

Optional filters (tuition, budget, language of study, region) narrow the results. There are no
filters by default, so the match is purely about taste.

## How Qloo powers it

Qloo is the core of the product: without Qloo there is no match. A Gemini agent calls Qloo through
function calling with four tools:

| Tool | Qloo call | Why it fits |
| --- | --- | --- |
| `qloo_search` | `GET /search` and `GET /v2/tags` | Turns free text into Qloo signals. A specific name becomes an **entity** (Dua Lipa, Studio Ghibli); a genre or hobby becomes a **tag** (techno, street food, hiking). The agent picks the right one per input. |
| `qloo_destination_affinity` | `GET /v2/insights`, `filter.type=urn:entity:destination`, `filter.results.entities=<our 67 cities>` | Scores every city in our dataset by taste affinity in a single request, plus Qloo's top destinations worldwide. |
| `qloo_similar` | `GET /v2/insights` with `filter.type` = artist, movie, tv_show, place | Powers "People like you also liked...". |
| `get_city_info` | Our curated `data/cities.json` | Adds universities, tuition and cost of living to the cities Qloo picked. |

The compare view makes one more Qloo call per city: `filter.type=urn:entity:place` with
`filter.location` set to the city, so you see places in that city that people with your taste
rate highest (hotels are filtered out).

### Example request (key removed)

For "Studio Ghibli, street food":

```
GET https://hackathon.api.qloo.com/v2/insights
  ?filter.type=urn:entity:destination
  &signal.interests.entities=<Studio Ghibli entity id>
  &signal.interests.tags=urn:tag:cuisine:qloo:street_food
  &filter.results.entities=<67 destination ids from data/cities.json>
X-Api-Key: <hidden>
```

Result (affinity shown as a percentage): Kyoto 97%, Tokyo, Hong Kong, Seoul, Singapore. The agent
then reads the city facts and writes the explanations.

### Why the agent can't make things up

Qloo decides which cities fit and how strongly: every score is a Qloo affinity. The LLM decides
which lookups to make and puts the results into words, but the tools only accept IDs that a Qloo
search actually returned, and the final city list is built from Qloo's response, not from the
model's text.

## How I built it

- **Next.js 16 (App Router), TypeScript in strict mode, Tailwind CSS**, deployed on Vercel.
- **Gemini with function calling** through a small OpenAI-compatible client, so the provider can be
  swapped with environment variables.
- **The agent's steps are streamed live** to the page ("Searching your tastes on Qloo...",
  "Matching cities worldwide...") and a full tool-call trace is shown under the results.
- **A typed Qloo client** with timeouts, bounded retries, caching and clear errors.
- **A curated dataset** of 67 cities, each resolved to its Qloo destination ID by a script and
  checked so that every city can actually be scored.

## Challenges

- **Destination results cluster.** The plain worldwide ranking often returns 50 cities from one
  country. Scoring our own city list with `filter.results.entities` solved it: one call, every
  city scored.
- **Some cities have no score.** Qloo returns no insights for Seoul's destination entry and has no
  entry for Lima. I score a nearby district instead (Suwon, Miraflores) and label it clearly.
- **Free LLM quotas.** The free Gemini tier is busy at peak times. The app tries other models,
  keeps a time budget, and if the AI is unavailable a fixed pipeline calls the same Qloo tools so
  users always get results.
- **Hobbies vs. names.** "anime" or "street food" match random entities by name. The agent (and the
  fallback) prefer Qloo tags for genre and hobby inputs.

## Accomplishments I'm proud of

- A working end-to-end agent that is genuinely useful in about 15 seconds.
- Results that make sense: Bad Bunny and tapas lead to Barcelona, Studio Ghibli to Kyoto.
- It degrades gracefully in every failure case I could think of.

## What I learned

How taste graphs differ from rankings, how to design tools so an LLM agent stays grounded in real
data, and how much reliability work a "simple" demo needs on free APIs.

## What's next

- Live tuition and cost data from official sources.
- More cities, and smaller university towns.
- Saving and comparing several searches.

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
