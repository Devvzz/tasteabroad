# TasteAbroad

Find the university city abroad where you'd actually feel at home.

Tell TasteAbroad what you love, like artists, films, shows, food and hobbies, and it uses
[Qloo](https://www.qloo.com/)'s taste graph to rank student cities around the world by cultural
fit, then shows well-known universities, typical international tuition and monthly cost of living
for each one.

> Work in progress for a hackathon. The full README (screenshot, architecture, deploy steps) is coming.

## How Qloo is used

| Step | Qloo endpoint |
| --- | --- |
| Turn your likes into Qloo entities | `GET /search` |
| Turn hobbies and genres into tags | `GET /v2/tags` |
| Score our curated cities by taste affinity | `GET /v2/insights` with `filter.type=urn:entity:destination` and `filter.results.entities` |
| Worldwide top destinations for your taste | `GET /v2/insights` with `filter.type=urn:entity:destination` |
| "People like you also liked…" | `GET /v2/insights` with other `filter.type` values |

The client lives in [`lib/qloo.ts`](lib/qloo.ts) (timeouts, bounded retries, in-memory cache,
typed errors). City data lives in [`data/cities.json`](data/cities.json); tuition and cost of
living are rough ranges, so always check the official university site.

## Local setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in your own keys
npm run dev
```

### Environment variables

| Name | Purpose |
| --- | --- |
| `QLOO_API_KEY` | Qloo API key (server-side only) |
| `GEMINI_API_KEY` | Google Gemini API key (server-side only) |
| `QLOO_BASE_URL` | Optional, defaults to `https://hackathon.api.qloo.com` |

Keys are only read in server code and never sent to the browser.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run test:qloo` | Smoke-tests the Qloo client against the live API |
| `npm run resolve:cities` | Looks up the Qloo destination ID for each city in `data/cities.json` |

## Licence

[MIT](LICENSE)
