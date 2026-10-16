# Adding a game to GameHub

A game is three small pieces that share one **id** (url-safe, lowercase, never changes, e.g. `ludo-lanes`):

1. **Rules** in `shared/<id>/`: pure JS, no DOM, no Worker APIs. Runs in the browser (bots, offline) and in the Worker (online).
2. **Frontend plugin** in `src/games/<id>/`: a tiny manifest plus lazy-loaded screens.
3. **Server adapter** in `worker/games/<id>.js`: the only place the Worker learns the rules.

Nothing else may know the game: the hub, lobby, `GameRoom`, leaderboard and database are generic.
**Hyderabad Tycoon is the reference**: copy its shape (`src/games/hyderabad-tycoon/`, `worker/games/hyderabad-tycoon.js`). The full contract is `docs/MARKETPLACE.md` (sections 3, 4, 5).

## 1. Folder layout

```
shared/<id>/index.js          createGame, applyAction, bot brain, result (+ *.test.js)
src/games/<id>/
  manifest.js                 TINY: metadata, settings schema, loaders (no engine, no pages)
  settings.js                 presets, schema, summary (pure, unit-tested)
  OfflineSetup.jsx            "play vs bots" setup; on Start: navigate(paths.offline(id), { state: { config } })
  OfflineGame.jsx             full-screen game; reads location.state or a saved game; exit -> paths.game(id)
  OnlineGame.jsx              full-screen online game; reads useParams().code; exit -> paths.game(id)
  <extra>.jsx                 optional pages (Story, Campaign...) listed in manifest.extras
  SettingsPanel.jsx           optional; shown in Profile > "Game settings"
  <id>.css                    the game's own styles (import it from the screens)
worker/games/<id>.js          the adapter (default export)
```

Rules for screens: every URL comes from `paths.*` (`src/platform/paths.js`), never a string like `'/play'`. Screens render inside the
hub (setup, extras) or full screen (game); they must not assume any hub chrome. Money: `formatINR` from `@shared/format.js`.

## 2. The manifest

```js
import { MyCover, MyIcon } from '@/components/art/hub/index.js'; // 16:9 cover + square icon
export default {
  id: 'my-game', name: 'My Game', tagline: 'One line, 48 chars max', description: '1-2 sentences',
  category: 'board',            // board | card | arcade | social | word | sports  (CATEGORIES in registry.js)
  status: 'live',               // 'coming_soon' needs only id, name, tagline, category, status, players, duration, theme, art
  players: { min: 2, max: 4 }, duration: '10-20 min',
  theme: { accent: '#ffc857', accent2: '#ff8a3d', bg: '#1b1340' },
  art: { cover: MyCover, icon: MyIcon },
  modes: { bots: true, friends: true, open: true },
  features: ['Bots', 'Online rooms'],
  howToPlay: [{ title: 'Roll', body: '...' }],            // 3-6 short steps
  extras: [{ path: 'story', label: 'Story', icon: 'book', loader: () => import('./Story.jsx') }],
  settings: SETTINGS_SCHEMA,    // host settings, see below
  summarize: (s) => 'Target 50 pts · 3 rounds',
  loaders: { offlineSetup, offlineGame, onlineGame, settingsPanel },   // () => import('./X.jsx'), default exports
  savedGame: () => null,        // or { title, subtitle, to: paths.offline(id) } for "Continue playing"
  stats: [{ key: 'wins', label: 'Wins' }],                // user_game_stats fields to highlight
};
```

**Settings schema** (rendered by the lobby, read-only chips for guests): `{ key, label, type: 'segmented'|'stepper'|'toggle',
options?, min?, max?, step?, default, format?: 'inr'|'number'|'text', help? }`. A `stepper` with `options` shows quick-pick chips
beside the +/- buttons. Defaults and limits **must equal** the adapter's `validateSettings`: copy
`src/games/hyderabad-tycoon/settings.test.js`, which fails when schema and server drift apart.

Minimum screens: `offlineSetup`, `offlineGame`, `onlineGame`. Setup may be a single "Start" button.
Online games use `useOnlineGame(code)` (`src/lib/session/useOnlineGame.js`) and the Tycoon `GameView` as a model: one `session`
object (`view`, `me`, `dispatch(action)`, `result`, `restart()`, `quit()`); the server redacts hidden state per viewer.

## 3. The server adapter

Start from `worker/games/hyderabad-tycoon.js`; the interface is documented at the top of `worker/games/index.js`
(`missingFromAdapter(adapter)` lists what is absent). Required: `id, name, minPlayers, maxPlayers, defaultSettings,
validateSettings(raw)`, `createGame({ players, settings, seed })`, `applyAction(state, action)` (**pure**; invalid -> same
state + `error`), `nextBotMove(state, rnd)`, `turnPlayerId(state)`, `deadlines(state)`, `idleAction(state, playerId)`,
`isOver(state)`, `result(state, meta)` -> `{ winnerId, reason, standings: [{ id, rank, score }] }`, `redact(state, viewerId)`,
`rivals(count)`. Treat every client value as hostile: `validateSettings` and `sanitizeAction` are allow-lists, never trust ids,
amounts or `playerId` from a message. State must be JSON-serialisable (no Infinity, Map or Set); randomness only via `seed`/`rnd`.

## 4. Register it

```js
// src/games/registry.js          (frontend)       // worker/games/index.js        (server)
import myGame from './my-game/manifest.js';         import myGame from './my-game.js';
const MANIFESTS = [tycoon, myGame, ...SOON_GAMES];  export const GAME_ADAPTERS = { ..., [myGame.id]: myGame };
```

Promoting a teaser: delete its file in `src/games/_soon/` and its line in `_soon/index.js`, then register the real manifest.
`getGame`, `/api/games`, the lobby, open tables, invites and the leaderboard tab pick the new game up automatically.

## 5. Database and stats (nothing to migrate)

A finished room is saved by `worker/match.js` from `result()`: `matches.game_id`, one `match_players` row per seat, and
`user_game_stats(user_id, game_id)` (games, wins, best_score = highest `score`, rating). XP and coins are platform-wide.
Rooms are listed from the `rooms` table, written by the Durable Object. Only add SQL if you need a new table, and keep it
additive and idempotent in `db/schema.sql` (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

## 6. Art

Add `<Name>Cover` (16:9) and `<Name>Icon` (square) as inline SVG/CSS (no external assets) under `src/components/art/hub/` and
export them from its `index.js`. They take `className`/`style`, scale to their box and read well at 64 px and 640 px.

## 7. Testing checklist

- `npx vitest run src shared worker` green; add tests for the engine (rules, fuzz with random bots to game over), the adapter
  (`missingFromAdapter` is empty, `validateSettings`, `redact`, bots always have a move) and the manifest/schema.
- `npx vite build` passes; the game page is its own chunk and the manifest import stays small.
- Visual: setup, a few offline rounds, game over, resume, online lobby + game at 390x844 and 1280x800; no console errors with
  the API down (offline mode must work without it).
- Online: two browsers, public + private room, disconnect and reconnect, AFK auto-play, a hostile client action rejected.

## 8. Game plugin checklist

| Piece | Where | Done when |
|---|---|---|
| Rules + bots + tests | `shared/<id>/` | pure JS, deterministic from a seed, fuzzed to game over |
| Manifest | `src/games/<id>/manifest.js` | fields above, tagline <= 48 chars, no heavy imports |
| Settings schema | manifest + `settings.js` | equals `validateSettings`; test proves it |
| Offline setup + game | `OfflineSetup.jsx`, `OfflineGame.jsx` | start, play, resume, exit to `paths.game(id)` |
| Online game | `OnlineGame.jsx` | joins `:code`, reconnects, leave works, results shown |
| Extras / settings panel | `extras`, `SettingsPanel.jsx` | optional |
| Saved game | `manifest.savedGame` | "Continue playing" shows title + subtitle + link |
| Server adapter | `worker/games/<id>.js` | `missingFromAdapter` empty; strict validation; redaction |
| Registration | `registry.js`, `worker/games/index.js` | one line each |
| Art | `src/components/art/hub/` | cover + icon, dark and light backgrounds |
| Stats | `result().standings` | wins, best score, rating appear in Profile and Rank |
| QA | section 7 | all boxes ticked at both sizes |
