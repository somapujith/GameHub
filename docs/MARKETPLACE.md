# GameHub marketplace — build contract

GameHub is a small **games marketplace** (reference: https://platoapp.com — a hub with a featured game, image-led cards grouped by category, a leaderboard, a People tab with friend links, public rooms, no-signup guest play, coins and profiles). **Hyderabad Tycoon is the first game, as a plugin.** More games will be added later, so nothing outside `src/games/<id>/`, `worker/games/<id>.js` and `shared/` (that game's rules) may know about Tycoon.

Stack is unchanged: React 19 + Vite 8 (plain JS/JSX, no TypeScript), Cloudflare Worker (Hono) + Durable Objects, Neon Postgres, Google login + guests.

## 0. Rules for every agent
1. **Work only in `A:\Coding\Projects\GameHub-marketplace`** (git branch `marketplace`). Never read-modify files in `A:\Coding\Projects\GameHub` (that is `main`; it auto-deploys to production and another session may be editing it). `node_modules` is a junction to the main folder's, and `.dev.vars` is a local copy; never print or copy secrets.
2. **Own only your files** (section 9). Other agents are building the rest at the same time; a module you import may not exist yet, so code to this contract. If you need something not in it, code defensively and say so in your report. Never edit files you do not own, `package.json`, `package-lock.json`, `index.html`, `src/platform/paths.js`, `src/platform/brand.js`, `vite.config.js`, or this file. All dependencies are installed (react, react-dom, react-router-dom, qrcode.react, hono, jose, @neondatabase/serverless, vitest, vite, wrangler). If you need another one, say so.
3. **No git commits or pushes** (the orchestrator commits). Throwaway files go in your scratchpad directory, not in the repo.
4. **The Neon database is PRODUCTION** (the live app reads and writes it). SQL must be additive and idempotent only: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS ... DEFAULT ...`, `CREATE INDEX IF NOT EXISTS`. Never DROP, TRUNCATE, rename, change a column type, or delete/update rows you did not create. Anything you insert for testing uses names that start with `zz_test_`; delete exactly those rows afterwards. Prefer in-process fakes over the real database.
5. **Ports** (parallel dev servers must not collide): platform-core Vite 5181, platform-home 5184, tycoon-plugin 5182, online 5183; Worker (wrangler): backend 8791, online 8792. Run the proxy as `API_PORT=8791 npx vite --port 5181 --strictPort`. Start wrangler with its own state folder: `npx wrangler dev --local --port 8791 --persist-to <your scratchpad>/wrangler-state` (sharing state between wrangler instances hangs them). Kill every dev server you start before you finish.
6. **Visual QA:** Playwright + Chromium are installed; `node C:\Users\somap\AppData\Local\Temp\claude\a--Coding-Projects-GameHub\54e66fa0-a520-495b-8ac4-fee992dd56ed\scratchpad\tools\shot.mjs <url> <out.png> [w] [h] [waitMs] [fullPage]` takes a screenshot and prints console errors (Playwright can be imported from that tools folder). Look at your screenshots with your image reader at 390x844 and 1280x800 and fix what you see.
7. **Quality bar:** mobile-first (360-430 px) and good at >=1280 px; 44 px touch targets; use CSS variables from `src/styles/tokens.css`; no external assets (inline SVG/CSS art, fonts via @fontsource already imported in `src/main.jsx`); money via `formatINR`/`compactINR` from `@shared/format.js`; respect `prefers-reduced-motion`; keyboard accessible; loading, empty and error states everywhere; no console errors when the API is unreachable. Every URL comes from `paths` in `@/platform/paths.js`.
8. Verify your work: syntax-check with `node_modules/.bin/esbuild <files> --loader:.js=jsx --log-level=warning --outdir=<scratchpad>`; run `npx vitest run <your tests>`; once everything exists `npx vite build` must pass. Final report <=200 words: what you built, public exports, deviations, known gaps.

## 1. Product flow
**Navigation** (Plato-style): bottom tab bar on phones, left rail >=900 px: **Games** `/` · **Friends** `/friends` · **Rank** `/leaderboard` · **Profile** `/profile`. A thin top bar shows the GameHub logo, a "Have a code?" action, coins and the profile chip. Game screens (`/play/**`) have no hub chrome.

**Games home `/`** (top to bottom): featured **hero** (the featured game's cover, name, tagline, big "Play now" and "With friends" buttons; rotates if several games are live) -> **Continue playing** (saved offline game + rooms you are in) -> **Friends online** strip (+ invite) -> **category chips** and one horizontal snap-scroll row per category that has games (Board, Card, Arcade, Social, Word, Sports; `coming_soon` games appear dimmed with a "Soon" badge and a local "Notify me" toggle) -> **Open tables** (public rooms across games, top 4) -> **Top players** teaser -> **daily reward**. Image-led cards: 16:9 cover, title, one-line tagline, player count, "Play" pill; accent colour from the game's `theme`.

**Game detail `/games/:gameId`:** cover banner, name, tagline, category, players, duration; mode cards **Play with bots** (-> `paths.setup`), **Play with friends** (creates a private room -> lobby; guests allowed), **Open tables** (-> `paths.tables`), **Join with a code**; "How to play" accordion; per-game top 5 and **your stats**; the game's `extras` (Tycoon: Story, Campaign); "Notify me" if coming soon.

**Rooms:** create (private by default; host may flip to **Public** to appear in open tables) -> `/lobby/:code` (code, share link, WhatsApp, QR, players, ready, add bot, host settings rendered from the game's settings schema) -> `/play/:gameId/online/:code`. Guests can host, join by code and play; friends, leaderboard and public tables listing need nothing extra (listing is public; hosting a public room needs a signed-in or guest session).

**Friends `/friends`:** your friend code and **friend link** (`/f/HYD-XXXX` opens an "Add <name>?" screen), requests and friends listed separately, online dots, **Invite to game** (pick game, then room). **Rank `/leaderboard`:** tabs Overall + one per game (`?game=`). **Profile `/profile`:** avatar and name, level/XP/coins, per-game stats, badges (derived from stats), and all settings (the old Settings page), account/login.

**Legacy URLs** (keep working, preserve `location.state`): see `LEGACY_REDIRECTS` in `src/platform/paths.js`, plus `/game/offline` -> `paths.offline(DEFAULT)` and `/game/online/:code` -> `paths.online(DEFAULT, code)` where DEFAULT is `BRAND.defaultGameId`.

**Visual language (hub):** dark neutral navy hub, vivid per-game accent colours carried by cover art; generous rounded corners (18-24 px), soft shadows, big friendly type, snap-scrolling card rows, pill buttons, subtle motion. Game screens keep each game's own theme. Hub pages must not look like the Tycoon dashboard any more.

## 2. Routes (owner: platform-core, in `src/App.jsx`)
| Path | Screen |
|---|---|
| `/` | Games home (platform-home) |
| `/games/:gameId` | Game detail (platform-core) |
| `/games/:gameId/play` | `manifest.loaders.offlineSetup` (plugin) |
| `/games/:gameId/tables` | Open tables for the game (platform-core) |
| `/games/:gameId/x/:extra` | `manifest.extras[].loader` (plugin) |
| `/play/:gameId/offline` | `manifest.loaders.offlineGame` (plugin, full screen) |
| `/play/:gameId/online/:code` | generic `OnlineGame` dispatcher (online) -> `manifest.loaders.onlineGame` |
| `/lobby/:code`, `/join`, `/join/:code`, `/f/:code`, `/friends`, `/login` | online |
| `/leaderboard`, `/profile` | platform-home |
Unknown `:gameId` or `coming_soon` game -> friendly "not available" state, never a crash.

## 3. Frontend game plugin (`src/games/<id>/manifest.js`)
`src/games/registry.js` (platform-core) imports each manifest eagerly and exports `GAMES` (ordered), `getGame(id) -> manifest|null`, `liveGames()`, `comingSoonGames()`, `CATEGORIES = [{id,label,icon}]` (board, card, arcade, social, word, sports), `featuredGame()`. **A manifest module must stay tiny (no engine, no React pages):** heavy code is behind `loaders`.

```js
export default {
  id: 'hyderabad-tycoon',                  // url-safe, never changes, also the server adapter id
  name: 'Hyderabad Tycoon',
  tagline: 'Buy Miyapur to Banjara Hills',  // one line, <= 48 chars
  description: '...',                       // 1-2 sentences
  category: 'board',                        // CATEGORIES id
  status: 'live',                           // 'live' | 'coming_soon'
  players: { min: 2, max: 6 },
  duration: '20-40 min',
  theme: { accent: '#ffc857', accent2: '#ff8a3d', bg: '#1b1340' },   // card/hero colours
  art: { cover: CoverComponent, icon: IconComponent },   // from '@/components/art/hub/index.js' (16:9 cover, square icon)
  modes: { bots: true, friends: true, open: true },
  features: ['Bots', 'Online rooms', 'Voice lines'],      // small chips
  howToPlay: [{ title, body }],                           // 3-6 short steps
  extras: [{ path: 'story', label: 'Story', icon: 'book', loader: () => import('./Story.jsx') }],
  settings: [ /* host settings schema (section 4) */ ],
  summarize(settings) { return 'Target ₹70,000 · 50 rounds' },   // one line for lobby/cards
  loaders: {
    offlineSetup: () => import('./OfflineSetup.jsx'),   // default export <Component /> (navigates to paths.offline on start)
    offlineGame:  () => import('./OfflineGame.jsx'),    // default export page, reads location.state / saved game
    onlineGame:   () => import('./OnlineGame.jsx'),     // default export page, reads useParams().code
    settingsPanel: () => import('./SettingsPanel.jsx'), // optional: default export <Component />, rendered inside Profile > "Game settings" (Tycoon: per-actor voice toggles, test voice)
  },
  savedGame: () => loadSavedGameMeta(),    // optional, sync: null | { title, subtitle, to } for "Continue playing"
  stats: [{ key: 'wins', label: 'Wins' }],  // which user_game_stats fields to highlight
};
```
Coming-soon manifests only need `id,name,tagline,category,status,players,duration,theme,art` (no loaders). **Placeholder coming-soon games** (platform-core writes the manifests under `src/games/_soon/`): "Ludo Lanes" (board, 2-4), "Carrom Club" (sports, 2-4), "Tambola Night" (social, 2-20), "Word Rush" (word, 2-6). They are teasers the owner can rename or delete; their art comes from the art agent (`ComingSoonCover({ id })`).

## 4. Settings schema (host settings, lobby + server)
Fields render in the lobby for the host (others see `summarize(settings)` plus read-only chips): `{ key, label, type: 'segmented'|'stepper'|'toggle', options?: [{value,label}], min?, max?, step?, default, format?: 'inr'|'number'|'text', help? }`. The same defaults/limits live server-side in the adapter's `validateSettings`, which is the source of truth. A shared `visibility` ('private'|'public') and `maxPlayers` exist for every game and are NOT in the schema.

## 5. Server game adapter (`worker/games/<id>.js`, registry `worker/games/index.js`)
`GameRoom` must contain no Tycoon knowledge: it talks only to an adapter.
```js
export default {
  id, name, minPlayers, maxPlayers,
  defaultSettings,
  validateSettings(raw) -> { ok:true, settings } | { ok:false, error },      // strict, untrusted input
  createGame({ players:[{id,name,avatar,isBot?,bot?}], settings, seed }) -> state,
  applyAction(state, action) -> { state, events, error? },                    // pure; invalid -> same state + error
  nextBotMove(state, rnd) -> action|null,
  turnPlayerId(state) -> playerId|null,           // who the idle timer waits for (Tycoon: debtor during debt)
  deadlines(state) -> [{ key, afterMs, playerId, action }],  // game timers besides the turn timer (Tycoon: 30 s trade auto-reject)
  idleAction(state, playerId) -> action|null,     // auto-play for an AFK/disconnected human
  isOver(state) -> boolean,
  result(state) -> { winnerId, reason, rounds?, standings:[{ id, rank, score }] },
  redact(state, viewerId) -> state,               // hide secrets before sending (Tycoon: other players' sealed bids)
  rivals(count) -> [{ name, avatar, bot }],       // names/avatars for bots added in the lobby
};
```
The Tycoon adapter wraps `shared/index.js` and the existing `worker/mask.js`, `worker/rivals.js`, `worker/settings.js`. `getAdapter(id)` returns null for unknown ids; the Worker answers 400 `unknown game`.

## 6. Database (additive only; `db/schema.sql`, applied by `scripts/migrate.js`)
- `matches.game_id text NOT NULL DEFAULT 'hyderabad-tycoon'` + `CREATE INDEX IF NOT EXISTS matches_game_idx ON matches(game_id, ended_at DESC)`.
- `user_game_stats(user_id uuid REFERENCES users(id) ON DELETE CASCADE, game_id text, games int NOT NULL DEFAULT 0, wins int NOT NULL DEFAULT 0, best_score int NOT NULL DEFAULT 0, rating int NOT NULL DEFAULT 1000, extra jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, game_id))`. Backfill once from existing `users` columns / `match_players` for `hyderabad-tycoon` (idempotent: `INSERT ... ON CONFLICT DO NOTHING`).
- `rooms(code text PRIMARY KEY, game_id text NOT NULL, host_id uuid, host_name text, visibility text NOT NULL DEFAULT 'private', status text NOT NULL DEFAULT 'lobby', player_count int NOT NULL DEFAULT 1, max_players int NOT NULL DEFAULT 4, settings jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())` + index on `(visibility, status, game_id, updated_at DESC)`. The room Durable Object upserts its row on create / join / leave / settings / start / finish and removes it on expiry; rows older than 24 h are ignored by queries. This table only powers listings; the Durable Object stays the source of truth.
- `users.xp/coins/level` stay platform-wide. Per-game numbers live in `user_game_stats`; the existing `users.games/wins/best_worth/rent_earned` columns keep being updated for Tycoon so the live (old) version keeps working during the rollout.

## 7. API additions (everything existing stays backward compatible; missing `gameId` means `hyderabad-tycoon`)
- `GET /api/games` -> `{ games:[{ id, name, minPlayers, maxPlayers, openTables:number }] }`
- `POST /api/rooms { gameId?, settings?, maxPlayers?, visibility? }` -> `{ code, gameId }`; `GET /api/rooms/:code` adds `gameId`, `visibility`, `settings`.
- `GET /api/rooms/open?game=<id>&limit=20` -> `{ rooms:[{ code, gameId, hostName, players, maxPlayers, summary?, createdAt }] }` (public, lobby, not full, fresh; no auth needed)
- `GET /api/rooms/mine` -> `{ rooms:[{ code, gameId, status, players, maxPlayers }] }` (auth)
- `POST /api/invites { code, userId }` pushes `{t:'invite', from, code, gameId, gameName}`
- `GET /api/leaderboard?game=<id>|overall` -> `{ rows:[{ rank, name, avatar, level, wins, games, bestScore, rating }] }` (overall ranks by xp)
- `GET /api/me` adds `gameStats: { [gameId]: { games, wins, bestScore, rating } }`
- WebSocket room messages: the `room` payload gains `gameId`, `visibility`; client may send `{t:'visibility', visibility}` (host, lobby only). Everything else is unchanged.
- `GET /api/friends/by-code/:friendCode` -> `{ user:{ id, name, avatar, level, friendCode, relation:'none'|'friends'|'outgoing'|'incoming' } }` (auth, non-guest) for the friend-link screen.

## 8. Migration of the existing code
Do not move the engine: `shared/**` stays. Tycoon-only React lives under `src/games/hyderabad-tycoon/` (new files that wrap/relocate `src/pages/{PlaySetup,Campaign,Splash,OfflineGame}.jsx` and the online game page). Components under `src/components/game/**`, `src/components/art/**` and `src/lib/session/**` stay where they are (they are Tycoon's, imported by its plugin). Generic bits (auth, api, socket, toast, shell primitives) stay shared.

## 9. File ownership
| Agent | Files |
|---|---|
| orchestrator (done) | `docs/MARKETPLACE.md`, `src/platform/paths.js`, `src/platform/brand.js`, `vite.config.js`, `package.json` |
| **platform-core** | `src/games/registry.js`, `src/games/_soon/**`, `src/App.jsx`, `src/components/shell/{AppShell,TabBar,TopNav,ProfileChip}.jsx` (+ any new file in `src/components/shell/nav/`), `src/pages/{GameDetail,GameTables,NotFound}.jsx`, `src/platform/game/**` (detail-page components), `src/styles/hub.css`, `public/manifest.webmanifest` + `public/_redirects` if needed |
| **platform-home** | `src/pages/{Home,Leaderboard,Profile}.jsx` (delete `SettingsPage.jsx` after moving its content to Profile), `src/platform/home/**` (GameCard, CategoryRow, Hero, ContinueRow, OpenTablesStrip, TopPlayers, etc.), `src/components/shell/home/**`, `src/styles/hubhome.css` |
| **tycoon-plugin** | `src/games/hyderabad-tycoon/**`, `src/pages/{PlaySetup,Campaign,Splash,OfflineGame}.jsx` (update paths/links; may be moved into the plugin folder and re-exported), `src/components/shell/gameSettings.js`, `docs/ADDING_A_GAME.md` |
| **backend** | `worker/**` (incl. new `worker/games/**`), `db/**`, `scripts/migrate.js`, `wrangler.toml`, `README.md` (backend + deploy sections) |
| **online** | `src/pages/{Lobby,JoinRoom,Friends,Login,OnlineGame,FriendLink}.jsx`, `src/components/online/**`, `src/lib/{api,auth,socket}.*`, `src/lib/session/useOnlineGame.js`, `src/styles/online.css` |
| **art** | `src/components/art/hub/**` (index exports: `HubLogo`, `HubMark`, `TycoonCover`, `TycoonIcon`, `ComingSoonCover`, `CategoryIcon`, `HubBackdrop`, `BadgeIcon`), `public/favicon.svg`, `public/icons/**` |
