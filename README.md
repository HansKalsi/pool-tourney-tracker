# 🎱 Pool League

Built with React, [Mantine](https://mantine.dev) and SCSS modules, and deployed on Vercel.

A small, friendly 8-ball league tracker for colleagues: matchups, bookings, results, a top-three podium, and per-player track records and head-to-heads.

- **No accounts.** Whoever creates a league is its admin. They invite other admins with one-time codes (Admin tab → *Invite admin*).
- **Public read-only.** Anyone with the league link can view it. Only admins can change anything.
- **Results:** each game is a *Win*, a *Win by default* (the opponent potted the black early), or a loss for the other player.
- **Skill rating:** everyone starts at **1000**. A win *captures* points from the opponent (Elo-style, zero-sum). Beating a stronger player captures more, and losing to a stronger player costs little, so newcomers aren't punished. Each game has **50 points wagered**: the two possible payouts always add up to 50. Equals play for 25 each, and with a 100-point gap the underdog stands to win 32 against the favourite's 18. As in official rules, a win by default counts as a normal win: it's recorded as "by default" in the history but pays the same points. Tune `K` in `src/lib/stats.ts`.
- **Best times to play:** players tick the office slots that suit them (Players tab or their own page). Anyone with the link can do this, since it's only a preference. When booking, the app suggests the next slot both players are free and skips slots that are already booked. Edit the slot list in `shared/slots.ts`.
- **Overview = stats page:** anyone opening the link sees headline numbers, **Next up** (every game on the next day of play, with what each player stands to win), latest results, the top 3, highlights and *Still to play*.
- **Games tab = calendar:** a two-week calendar of booked games and results. Open office slots are filled with **"Book match"** suggestions taken only from the league's *to book* matchups, when both players' preferred times fit (players who haven't played yet come first). Admins book a suggestion in one tap. Any to-book matchup that fits no slot is listed under the calendar with the reason. Compact Booked / To book / Results lists sit alongside it.
- **Still to play:** a panel on the Overview lists, for each player, the opponents they haven't played yet (faded once booked) with overall progress. Admins tap a ball to book that game.
- **Single-screen layout:** on desktop, the Overview, Games, Players, player and Admin pages all fit the window, with panels scrolling inside themselves when needed.
- **No login for players:** anyone with the link can view everything and set their play times. "Admin sign-in" is only for people managing the league.
- **Kept upbeat:** there's no full league table. The overview shows a top-three podium by rating and positive-only highlights, and losses are shown in neutral grey.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (API served by Vite, data saved in ./.data)
npm run seed         # optional: creates a demo league with dummy data and prints the links
npm test
```

You don't need a database or the Vercel CLI locally. Without Redis credentials, the API saves each league as a JSON file in `./.data/`.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo.
2. On [vercel.com](https://vercel.com), click **Add New → Project** and import the repo. It auto-detects Vite, so keep the defaults.
3. In the project, open **Storage → Create Database → Upstash for Redis** (the free plan is plenty) and connect it to the project. This adds the `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars.
4. **Redeploy** so the env vars are picked up. Your site is live at `https://<project>.vercel.app`.

If the database isn't connected yet, the API answers with a clear "No database connected" message rather than silently losing data.

## How admin access works

- When you create a league, your browser stores a secret admin key. The Admin tab shows your **personal admin link** (`…/l/<id>#key=…`). Bookmark it or open it on your phone to sign in there. The key sits after the `#`, so it's never sent to the server in the URL.
- **Invite codes** (e.g. `K7QM-2XPA`) work once and expire after 7 days. You can share the code itself or an invite link.
- The server stores only SHA-256 hashes of keys and codes.
- The league creator can remove other admins. Any admin can leave.
- **Activity log** (Admin tab, admins only): every change is recorded server-side with who made it and when. That covers results, bookings, players, play times (changes by people who aren't signed in show as "Someone (not signed in)"), invites, admins joining or leaving, and league renames. It can be filtered to *Admin & setup* and keeps the last 300 entries.

## Project layout

```
api/league.ts        Vercel serverless function (GET ?id=… / POST { action, … })
server/handler.ts    All API logic, validation, auth; retries on concurrent edits
server/store.ts      Upstash Redis store (atomic compare-and-set) + local file store
shared/types.ts      Types shared by API and UI
shared/slots.ts      The office time slots players can pick
src/theme.ts         Mantine theme (felt-green primary colour, component defaults)
src/styles/          Global SCSS + shared mixins (dark mode, hover, breakpoints), auto-injected into every .scss file
src/lib/stats.ts     Skill rating, podium, streaks, head-to-head, timeline (pure, tested)
src/lib/schedule.ts  Calendar days + "book match" pairing suggestions (pure, tested)
src/pages/…          Home, league overview, games, players, player detail, admin
src/components/…     Match cards, dialogs, podium, charts — each with a *.module.scss
```
