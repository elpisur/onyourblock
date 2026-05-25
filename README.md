# onyourblock-web
Frontend for **On Your Block** — a civic awareness web app for New York
City (Manhattan & Brooklyn for now). Type in your ZIP, see what's actually happening near you that you can vote in, show up to, or comment on. Participatory budgeting votes, community board meetings, council elections, comment periods. Real events, real dates,
links back to the official source.

Live at **[onyourblock.vercel.app](https://onyourblock.vercel.app)**.

Backend (the part that scrapes and serves the data) is in a separate
repo: **[onyourblock-api](https://github.com/elpisur/onyourblock-api)**.

## Why this exists
All meaningful information is publicly available - NYC Council, the Board of Elections,
every community board, they all publish their calendars and deadlines. The problem is nobody tells you when something matters that directly impacts you and the neighborhood you live, in time to do anything about it. This app is trying to close that gap. It surfaces the
civic events that are happening on your block, in one clear interface, with a
direct link to action.

No accounts. No tracking. No editorial spin. The app points you to the door; you decide whether to walk through it.

## Tech stack
- **React 19** + **Vite 8** — single-page app, most of the code lives in `src/App.jsx`
- **Tailwind 4** for styling
- **lucide-react** for icons
- Hosted on **Vercel** (auto-deploys and refreshes from `main`)

Backend is a separate Node + Fastify + SQLite service on Railway. This repo just calls its endpoints.

## Run it locally
```bash
npm install
npm run dev        # Vite dev server, usually on :5173
```

Other commands: `npm run build`, `npm run preview`, `npm run lint`.

## Environment variables
There's one: `VITE_API_BASE_URL`. It tells the frontend where to find the backend.

## Deploy
Pushing to `main` triggers a Vercel build and deploy automatically. That's the whole flow.

## What's not done yet
This is an early-stage project. Some honest caveats:

- **Manhattan has the best coverage.** Brooklyn CB14 is wired up; the other 17 Brooklyn CBs are stubbed. Queens, Bronx, and Staten Island community boards aren't scraped yet. Those are backend problems, frontend will still accept zipcodes, just display little to no results.
- **ZIPs without a council-district mapping return no history.** Same reason — backend coverage.
- **English only for now** Translation plumbing is planned (backend has the locale files in place) but the frontend doesn't switch yet.

## How I'm working on this
I'm a non-developer learning by building, so the code reflects that — most of the app is in one `App.jsx` file because that's what I could keep in my head while iterating. It will get refactored. Suggestions and PRs are welcome; please be patient with explanations, we're talking ELI 5-10.

## Editorial rules (these apply to the frontend too)
- No fabricated civic data. Empty state > inventing an event.
- No candidate endorsements or political framing of any kind, just relaying current state of affairs
- No fake urgency, no guilt prompts, just confirmations of "are you a registered voter?" with explanation on why we ask.
- Every event shown links to its official source (citing/transparency)

## License
TBD — will add before any wider release.
