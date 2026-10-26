# TasteAbroad

Find the university city abroad where you'd actually feel at home.

- Live demo: https://tasteabroad.vercel.app (no login)
- Code: https://github.com/Devvzz/tasteabroad (MIT licence)

One thing first, because it matters for everything below: the match scores come from Qloo's data,
not from the AI. Qloo ranks all 105 cities separately for each of your tastes, and a city's score
is its average position across those rankings. Every card shows the breakdown ("Studio Ghibli #1 of
105 · ramen #2 of 105"). The AI decides which Qloo lookups to make and writes the short notes
around Qloo's results.

## Inspiration

Every year millions of students pick a city to study abroad by looking at rankings and tuition.
Then many of them feel lost for months, because the city simply doesn't fit them: the music, the
food, the way people spend their evenings. Nobody asks "will I feel at home there?" before
signing up. I wanted a tool that asks exactly that question, for any student from any country.

## What it does

It tries to answer three questions at once: will I fit in culturally, can I study there in a
language I speak, and can I afford it?

You type what you love: artists, films, shows, food, hobbies, brands or places, for example
"Studio Ghibli, ramen, jazz". Qloo then ranks a hand-picked list of 105 student cities on every
continent once for each of those tastes, and you get your top 5 with a match score and a per-taste
breakdown, so you can see why a city made the list. For that search Kyoto comes first, number 1 of
105 for Studio Ghibli and number 2 for ramen.

Each city card has a short note that refers to what you typed, well-known universities with links,
typical international tuition, the monthly cost of living as honest ranges, the languages you can
study in, Erasmus+ status, and official government scholarship links (DAAD, Chevening, Fulbright,
MEXT and others) for that country.

Around the top 5 there is more to explore:

1. A taste map with all 105 cities coloured by fit (there's a Europe zoom, since a third of the
   cities are there), and a picker to see where any city ranks for your tastes.
2. A best value pick: the cheapest year of study among your 15 best matches.
3. A side-by-side comparison of two cities, including places in each one that people with your
   taste love, straight from Qloo.
4. "People like you also liked...": artists, films, TV shows and places from Qloo.

Each like is checked with Qloo as soon as you add it. If Qloo has no city data for one (hiking, for
example), the app says so right away instead of quietly ignoring it.

One switch limits results to English-taught programmes; "I also speak..." adds other languages,
which matters because many public universities are free or cheap in the local language (German in
Berlin, Spanish in Mexico City). Optional filters cover tuition, budget and region. Tuition filters
use the fee non-EU students pay (Stockholm is free for EU students but $9k+ for others) unless you
tick "I have an EU/EEA passport". Nothing is filtered by default, so the match is purely about
taste. It works on a phone, and every result is a shareable link.

## How Qloo powers it

Without Qloo there is no match. A Gemini agent calls Qloo through function calling with four tools:

| Tool | Qloo call | What it is for |
| --- | --- | --- |
| `qloo_search` | `GET /search` and `GET /v2/tags` | Turns free text into Qloo signals. A specific name becomes an entity (Dua Lipa, Studio Ghibli); a genre or hobby becomes a tag (techno, street food). The agent picks the right one per input. |
| `qloo_destination_affinity` | `GET /v2/insights`, `filter.type=urn:entity:destination`, `filter.results.entities=<our 105 cities>`, once per taste | Ranks every city in our list for each taste, then combines the ranks. Also fetches Qloo's top destinations worldwide. |
| `qloo_similar` | `GET /v2/insights` with `filter.type` = artist, movie, tv_show, place | "People like you also liked...". |
| `get_city_info` | Our own `data/cities.json` | Universities, tuition, cost of living and teaching languages for the cities Qloo picked. |

While you type, the input suggests matches live from Qloo (`GET /search` and `GET /v2/tags`, ranked
by Qloo popularity), so "tay" offers Taylor Swift and "sush" offers Sushi before the agent starts.

The compare view makes one more Qloo call per city: `filter.type=urn:entity:place` with
`filter.location` set to the city, so you see places there that people with your taste rate
highest. I keep restaurants, bars, cafés, sights, museums, parks and similar, and drop hotels and
trade fair venues.

### How a taste becomes a city ranking

Names go to Qloo directly. Most genre and hobby tags have no city data of their own (on its own,
"jazz" gives every destination the same affinity), so the app first asks Qloo which entities carry
the tag, then ranks the cities for those:

```
# 1. Who stands for "jazz"?   -> Miles Davis, Diana Krall, Chet Baker, Billie Holiday, Jamie Cullum
GET https://hackathon.api.qloo.com/v2/insights
  ?filter.type=urn:entity:artist
  &signal.interests.tags=urn:tag:genre:music:jazz

# 2. Rank all 105 cities for them   -> Lisbon, Washington D.C., Porto, New York, ...
GET https://hackathon.api.qloo.com/v2/insights
  ?filter.type=urn:entity:destination
  &signal.interests.entities=<those artists' ids>
  &filter.results.entities=<105 destination ids from data/cities.json>
X-Api-Key: <hidden>
```

Each taste gives one Qloo ranking of all 105 cities. A city's match score is its average percentile
across your tastes (100 means first for every taste), and the card shows each rank. Food tags carry
city data directly and music genres go through their artists. Tastes Qloo has no city data for are
left out, and the page says which ones.

### Why the AI can't make up a ranking

| | Decides |
| --- | --- |
| Qloo | Where every city ranks for each of your tastes. Scores and order come from those rankings only. |
| AI agent | Which lookups to make, and the wording of the notes. The tools only accept IDs that a Qloo search actually returned, and the city list is built from Qloo's response, not from the model's text. |
| Our dataset | Universities, tuition, costs and teaching languages, marked as estimates with official links. |

The app says this on every result page too. Each card labels its score "Based on Qloo" and lists the
per-taste ranks, and a readable log shows every Qloo call the agent made.

## How I built it

Next.js 16 (App Router) with TypeScript in strict mode and Tailwind CSS, deployed on Vercel. Gemini
handles function calling through a small OpenAI-compatible client, so the provider can be swapped
with environment variables. The agent's steps stream live to the page ("Searching your tastes on
Qloo...", "Matching cities worldwide...") and the full tool-call log sits under the results. The
Qloo client is typed and has timeouts, bounded retries and caching. The 105 cities are a dataset I
built by hand; a script maps each one to its Qloo destination ID and checks that Qloo can score it.

## Challenges

Destination results cluster. Qloo's plain worldwide ranking often returns 50 cities from one
country. Scoring my own city list with `filter.results.entities` fixed that, and every city gets a
score.

Not every city exists in Qloo. There's no destination for Wellington or Kigali, so I replaced them
with cities it can score (Christchurch, Kampala). Seoul and Lima are scored through a district in
the same metro area (Suwon, Miraflores), and the card says so.

Every city looked the same at first. Scoring all tastes in one call put every city between 0.69 and
0.82, and one famous name drowned out the hobbies. Testing showed why: most tags (jazz, techno,
climbing, hiking) give every destination exactly the same affinity. Scoring each taste on its own,
and going through the entities Qloo associates with a tag, fixed it. Techno now puts Berlin first
and anime puts Kyoto first, and every card can show where the city ranks for each taste.

Hobbies and names get mixed up. "anime" or "street food" match random entities by name, and "EDM"
once matched a shopping mall. The app prefers Qloo tags for genres and hobbies and exact names over
partial ones.

Free LLM quotas and latency. On the free tier Gemini models sometimes stop answering for minutes,
and tracing every call showed searches spending most of their time waiting on those hangs. Now each
call goes to two models at once and takes the first answer, a model that hangs is set aside for a
few minutes, and the cities appear as soon as Qloo has ranked them while the notes are written in
parallel. Under the same bad conditions that took searches from 45 seconds with template notes to
10 to 27 seconds with real ones. If the AI is unavailable, a fixed pipeline calls the same Qloo
tools, so you always get results with the same Qloo scores.

## Accomplishments I'm proud of

It works end to end, and the cities usually appear within 10 to 20 seconds. The results make sense:
Studio Ghibli, ramen and jazz lead to Kyoto; techno, tapas and Stromae to Amsterdam; Hozier, fado
and seafood to Lisbon. And it keeps working when parts fail, which on free APIs happens a lot.

## What I learned

How taste graphs differ from rankings, how to design tools so an LLM agent stays grounded in real
data, and how much reliability work a "simple" demo needs on free APIs.

## What's next

Live tuition and cost data from official sources, more cities including smaller university towns,
and more app languages, starting with Albanian and German.

## Limitations

Qloo scores describe what groups of people with similar tastes enjoy. They are not a prediction
about one person and say nothing about admission chances, visas or safety. Tuition and living costs
are rough estimates, and each city links to the official university sites. No personal data is
collected: only the likes you type are sent to Qloo and Gemini.

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
