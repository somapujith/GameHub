# Hyderabad Tycoon: game rules, state machine and wire protocol

This is the authoritative description of the game as it is built. It is the contract between the rules engine
(`shared/engine.js`), the room server (`worker/GameRoom.js`, `worker/games/hyderabad-tycoon.js`, `worker/validate.js`,
`worker/settings.js`, `worker/mask.js`) and the client (`src/lib/session/*`, `src/components/game/*`,
`src/components/online/*`). Board data lives in `shared/board.js` (spec: `hyderabad-monopoly.md`).
Every section was checked against the code on 2026-10-31. Where code and contract disagree in a way that looks like a bug,
it is listed in section 14 (Known discrepancies) instead of being papered over. Sections marked **[contract]** are the
spec the code was written to; they were re-verified against the code.

Contents: 1 fixed decisions · 2 settings · 3 turn flow · 4 dice, movement, jail · 5 squares and money rules ·
6 auctions · 7 bankruptcy and game end · 8 wire protocol · 9 Snatch · 10 tokens and Shield · 11 city events ·
12 UI contract for 10 and 11 · 13 traps · 14 known discrepancies.

## 1. Fixed decisions

* **One die, always.** There is no two-dice mode. `cfg.diceCount` does not exist. `state.dice` is a
  one-element array `[d]` (`[0]` = not rolled yet) and every `dice` event carries a one-element array.
  A **six rolls again**; a six in jail **leaves jail** (see 4). The `dice` setting only chooses how the
  die is drawn (`lucky` helps the player behind, `fair` is uniform).
* **Humans only (2-6 per room).** There are no bots, no ready toggle and no public-table browsing in the product.
  The server still *auto-plays* an idle or disconnected human seat with the engine's move chooser
  (`shared/bots.js`, see 8.8). Auto-play never snatches, shields or sets traps, and never offers trades.
* **English only.** There are no voice lines, subtitles or translated strings anywhere.
* **Server authoritative.** Clients send intents, the room forces `playerId`, validates through the adapter allow-list and the
  engine, applies the action and broadcasts `{state, events, seq}`.
* **Online only.** No offline, story or campaign mode. Every game is played in a room.

## 2. Settings and constants

Host settings (validated by `worker/settings.js`, mirrored in `src/games/hyderabad-tycoon/settings.js`; `settings.test.js`
fails when the two drift):

| Key | Accepted | Default | Notes |
|---|---|---|---|
| `goal` | integer 10,000 - 1,000,000 | 70,000 | "End cash limit": first to this **net worth** wins. The only setting the lobby shows. |
| `startCash` | integer 5,000 - 100,000 | 15,000 | not shown in the lobby |
| `maxRounds` | exactly `30`, `50` or `null` (unlimited) | 50 | richest wins when the rounds run out; not shown |
| `dice` | `'lucky'` \| `'fair'` | `'lucky'` | not shown |
| `auctionOnDecline` | boolean | `true` | a skipped tile goes to a sealed auction; not shown |
| `snatches` | integer 0 - 3 | 1 | Snatch tokens each player starts with (0 turns the whole token system off); not shown |
| `snatchMs` | integer 1,000 - 10,000 | 3,000 | length of the Snatch window; not shown |
| `maxPlayers` | integer 2 - 6 (room setting, also accepted inside `settings`) | 4 | seats |

Engine-only values (in `state.cfg`, not host-settable): `passStart` 2,000 (salary), `bailFine` 500, `jailTurns` 1.
Unknown keys (`debug`, `seed`, echoed engine values) are ignored by the server. The room stores the 7 host keys; `room.settings`
(what the lobby shows) is the engine's full normalised `cfg`, which is also what `state.cfg` becomes at start.

Constants in `shared/board.js`: `BOARD_SIZE` 40, `START_TILE` 0, `JAIL_TILE` 10, `PARKING_TILE` 20 (Irani Chai & Biryani Break),
`GO_TO_JAIL_TILE` 30, `MAX_LEVEL` 5 (Hotel), `TOKEN_CAP` 3, `LAPS_PER_TOKEN` 3, `TRAPS_EACH` 1, `SELL_RATIO` 0.5,
`UNMORTGAGE_INTEREST` 0.1. `shared/events.js`: `EVENT_EVERY` 5.

## 3. Turn flow (phases)

`state.phase` is one of: `roll`, `buy`, `snatch`, `auction`, `manage`, `debt`, `over`.

```
roll   --ROLL--> move clockwise, then land:
                   free property/station/utility, cash >= price -> buy
                   free tile, cash < price                       -> manage (nothing is offered, NO auction)
                   tile owned by someone else                    -> rent (debt if short, bankrupt if hopeless)
                   tax / card square / Go to Jail                -> paid / drawn / jail
                   someone else's trap on the tile               -> jail, the tile's own effect is skipped
roll   --PLACE_TRAP--> roll   (turn player, before rolling; does not end the turn)
buy    --BUY--> snatch   (if some other active player holds a token) --SNATCH_CLOSE--> manage | auction (snatch bidding)
buy    --BUY--> manage   (nobody holds a token)
buy    --BUY {shield:true}--> manage   (spends a token, no window)
buy    --SKIP_BUY--> auction (auctionOnDecline) | manage
manage --END_TURN--> roll of the next active player
manage --ROLL--> ...    (only while state.extraRoll, i.e. after a six)
any    --payment too big--> debt --PAY_DEBT--> returnPhase (manage)
```

Also legal in `roll` / `manage` (turn player): `UPGRADE`, `MORTGAGE`, `UNMORTGAGE`, `SELL_BUILDING`, `TRADE_OFFER`.
Out of turn, anybody may `BID` (auction), `SNATCH` (snatch window), answer a trade addressed to them, or `RESIGN`;
the debtor may mortgage / sell / pay in `debt`.
One **round** = every active (non-bankrupt) player has taken one turn (bonus rolls do not count). `state.round` starts at 1 and
increases when play wraps past the last seat. A city event may be drawn at the start of a round (11).
Seat order is shuffled with a CSPRNG when the host presses Start; seat 0 plays first.

## 4. Dice, movement, jail

* ROLL draws one die. Movement is clockwise, tile 39 wraps to 0; passing or landing on START pays
  salary (2,000) exactly once (also for cards that move you forward). Moving backwards never pays.
* A six grants one extra roll (`state.extraRoll`). Three sixes in a row are NOT special. Being thrown in jail removes the extra roll.
* **Lucky dice** (`shared/dice.js`, `DICE_RULES`, all disclosed in the Rules sheet): a bounded bias on the six faces. Comeback (below 0.8x /
  0.5x of the average net worth: more weight on useful landings, less on landings with rent >= 25% of cash), mercy (after 2 turns paying rent
  >= 1,000: less weight on landings with rent >= 1,000), pity six (after 6 non-sixes a six is 1.5x), anti-streak (after 2 sixes in a turn a six is
  0.5x); each face is clamped to 0.6x-1.5x before normalising. The `dice` event reports the strongest rule in `assist` (or `null`). `fair` is uniform.
* **Jail.** Go to Jail (tile 30), the "Police Naka-Bandi" card and a sprung trap send you to tile 10 with no salary and end the turn
  (extra roll lost). In jail, before rolling you may `PAY_BAIL` (500, needs the cash) or `USE_JAIL_CARD`. If you roll instead:
  **a six leaves jail and moves that many squares** (no extra roll, event `jail` reason `six`); any other number is a failed roll: with
  the default `jailTurns` of 1 the player is released at once (`jail_stay` then `jail` reason `served`) and **the turn ends: no move, no bail**.
  So a jailed player normally loses exactly one turn and moves again on the one after.

## 5. Squares, rent, building, mortgage, tax, cards

Exactly as `hyderabad-monopoly.md` / `shared/board.js` (verified by an automated audit):
property rent table (base, 1-4 houses, hotel), the full colour set doubles base rent of UNBUILT tiles
and unlocks building, stations 250/500/1000/2000 by number owned, utilities 40x / 100x the die,
GHMC tax = the lower of 2,000 and 10% of net worth (rounded to 10), ORR challan 1,000, Irani Chai & Biryani Break does nothing
(except earn a token, 10.2), mortgage = `tile.mortgage`, lifting costs +10%, building cost = `houseCost`, even building (and even selling),
selling a building refunds 50% of `houseCost`. Mortgaged tiles collect no rent and block building on their whole colour.
24-card shared deck (Nawab ka Farman and Hyderabadi Khazana squares both draw from it; one card is Get Out of Jail Free and is kept
until used).

## 6. Auctions

Sealed, simultaneous. `pending = { type:'auction', tile, minBid, bids }`. `BID {amount}` once per
player (0 = pass), amount `>= minBid` and `<= cash`. Highest valid bid wins, ties go to the earliest
seat counted from the current turn player. Players who cannot afford `minBid` are auto-passed.
`minBid = max(10, round(price * 0.1 / 10) * 10)`. Everyone active may bid, including the player who skipped. The winner pays the bank.
No valid bid: the tile stays unowned. After the auction the phase goes to `pending.returnPhase || 'manage'`.
Auctions open only for a **skipped** tile (`SKIP_BUY` with `auctionOnDecline`) and for Snatch bidding (9.5); an unaffordable tile is not offered at all.

## 7. Bankruptcy and game end

### 7.1 Net worth and liquidation value
* `netWorth` = cash + for each owned tile (`price`, or `price - mortgage` if mortgaged) + `level * houseCost`.
* `liquidationValue` = for each owned tile: `level * round(houseCost * 0.5)` plus the `mortgage` value if it is not mortgaged yet.

### 7.2 Debt phase
A payment (rent, tax, card, including the several payees of a "pay each player" card) that the payer's **cash cannot cover** is handled so:
* cash >= amount: paid at once (`cash` events, creditor gets the money).
* cash < amount but `cash + liquidationValue >= amount`: the game pauses in `phase 'debt'` with
  `state.debt = { player, amount, creditor|null, reason: 'rent'|'tax'|'card', returnPhase, rest }` and a `debt` event.
  `rest` holds the remaining payments of the same cause, replayed after the debt is settled. `creditor` is `null` for the bank.
* otherwise: immediate bankruptcy (7.3), no debt phase.

In the debt phase **the debtor acts even when it is not their turn**; only `MORTGAGE`, `SELL_BUILDING`, `PAY_DEBT` and `RESIGN` are legal
(anything else, including `UNMORTGAGE` and `UPGRADE`, fails with `Raise cash and settle the debt first`). `PAY_DEBT` needs
`cash >= amount` (`Raise ₹X more first`), moves the money, sets `phase = returnPhase` and runs `rest`. The debtor has the normal 45 s
decision timer; auto-play mortgages the cheapest tile first, then sells buildings (tallest first), then pays; if the engine refuses three
auto moves in a row the player is resigned (8.8). Mortgaging needs the whole colour free of buildings, selling must be even.

### 7.3 Bankruptcy (`bankruptPlayer`)
Triggered by an unpayable debt (7.2) or by `RESIGN` (7.4). In order:
1. Every building the player owns is sold to the bank (`level` events reason `bankrupt`, `cash` reason `liquidate`).
2. If a **creditor** exists (a player who is not bankrupt): all the cash goes to them (`cash` events), and they receive every property
   (`own` reason `bankrupt`, `owner` = creditor; mortgaged tiles stay mortgaged; `set_complete` fires for sets they now hold). If the creditor is the bank
   (tax, card to the bank, resign outside a debt): every property becomes unowned and unmortgaged (`own` with `owner: null`).
3. Jail cards go back to the deck, the player's placed traps are removed, `cash = 0`, jail cleared, a pending trade of theirs is cancelled
   (`trade_rejected` reason `bankrupt`), and a `bankrupt` event is emitted. `player.bankrupt = true`; the seat stays in `state.players`.

Bankrupt players never act again, are never eligible for Snatch, are skipped in turn order (a bankrupt turn player's turn ends automatically
once no auction / debt / snatch window is open) and are not counted by anything that says "active players".

### 7.4 Resign
`RESIGN` is legal at any time for any non-bankrupt player, even out of turn and during a trade, auction, debt or snatch window.
* In their own debt: bankruptcy to the debt's creditor with the debt's reason, then `rest` is replayed.
* Otherwise: bankruptcy to the bank (properties unowned).
* In an auction: their bid becomes 0 (and the auction may resolve). In a snatch window: they are removed from `claims`; the window keeps running.
  A resigning **buyer** loses the tile to the bank at once, so the tile (now unowned) can still be snatched for free when the window closes;
  if nobody snatches it, it stays unowned.
* In a pending trade involving them: cancelled.

Sending `{t:'leave'}` from a running game resigns the player (if the game is not over) and marks the seat `left`, then closes their sockets.

### 7.5 Winning (`checkWin`, run after **every** applied action)
Checked in this order; the first that applies ends the game:
1. **Last standing** (`winReason 'last_standing'`): at most one non-bankrupt player is left. That player wins (no winner if everyone went bankrupt at once).
2. **Net worth** (`'net_worth'`): at least one active player has `netWorth >= cfg.goal`. The one with the **highest** net worth wins; a tie goes to the
   earliest seat. This can fire in the middle of anybody's turn (for example when a player receives rent or a snatched property).
3. **Rounds** (`'rounds'`): `cfg.maxRounds` is a number and `state.round > maxRounds`, that is the moment the last player of round `maxRounds`
   ends their turn. The **richest** active player wins; ties go to the player with the **most cash**, then the earliest seat. `maxRounds = null` never triggers this.

Ending sets `phase 'over'`, clears `pending`, `trade`, `debt` and `extraRoll`, fills `winner` and `winReason`, and emits
`{type:'win', player, reason, worth}` (the winner's final net worth). Every action after that is refused with `The game is over`.
A room that nobody is connected to for 5 minutes (or where every seat has left) is **abandoned**: `status 'finished'`, but `state.phase` is not `'over'`
and nothing is recorded.

### 7.6 Result and ranks
When the room finishes, the adapter's `result()` is written once to Neon (`worker/match.js`):
`{ winnerId, reason, rounds: min(round, maxRounds) or round when unlimited, standings: [{ id, rank, score: round(net worth), stats: { rentEarned, hotelsBuilt } }] }`.
`standings()` ranks by net worth (descending), then non-bankrupt before bankrupt, then seat. XP, coins, Elo rating and per-game stats come from the
ranks (`worker/xp.js`, `worker/rating.js`). See section 14 for a case where rank 1 is not the winner.

## 8. Wire protocol

### 8.1 Connection
* `GET /ws/room/:code` (room code = 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, case-insensitive). The Worker requires a WebSocket upgrade
  (`426 Expected a WebSocket upgrade.`), a same-origin `Origin` (`403 Cross-origin request refused.`) and the session cookie, then forwards to the room's
  Durable Object with trusted headers `X-User-Id`, `X-User-Name` (percent-encoded), `X-User-Avatar`, `X-User-Guest`. Clients cannot set these.
* A refusal is delivered as an accepted socket that is closed at once with an application close code (so the client stops retrying):

| Code | Reason text | When |
|---|---|---|
| 4001 | `Please sign in first.` | no valid session (sent by the Worker) |
| 4004 | `That room code is not valid.` | malformed code (Worker) |
| 4004 | `That room does not exist.` | no such room (an `error` message with the same text is sent first) |
| 4004 | `This game is no longer available.` | the room's `gameId` is not registered any more |
| 4003 | `You were removed from this room.` | kicked less than 10 minutes ago |
| 4003 | `This game has already started.` | not a member and the room is not in the lobby |
| 4003 | `This room is full.` | lobby with `maxPlayers` seated |
| 4009 | `replaced` | the user already had 3 open sockets here: the oldest is closed |
| 4003 | `kicked` | after the `kicked` message |
| 4004 | `expired` | after the `error` `This room has expired.` |
| 1000 | `left` / `closed` | after `leave` / normal close |

* **Connecting is joining.** There is no HTTP join call: a non-member who connects while the room is a lobby with a free seat is seated
  (display name and avatar come from the session). A member can reconnect at any time (lobby, playing, finished); their `left` flag is cleared.
* Frames are UTF-8 JSON text, at most 4,096 characters, with a string field `t`. Binary: `error` `Only text messages are supported.`;
  too long: `Message too large.`; bad JSON or no `t`: `Invalid message.`
* Rate limit: more than 40 messages in 5 seconds from one user (pings excluded): `You are sending messages too fast.`
* On accept the server broadcasts `room` to everybody, then (if a game exists) sends `state` with `events: []` to the new socket only.
* When the host starts the game, everybody receives `room` (status `playing`) and then the first `state` (`seq` 1, `events: []`).
* Heartbeat: the client sends `{"t":"ping"}` every 20 s; the Durable Object answers `{"t":"pong"}` from an auto-response without waking up.

### 8.2 Client -> server

| `t` | Fields | Who / when | Errors (`{t:'error', message}`) |
|---|---|---|---|
| `ping` | | anyone | none (reply `pong`) |
| `settings` | `settings`: object with any of `goal startCash maxRounds dice auctionOnDecline snatches snatchMs maxPlayers` | host, lobby only. The patch is merged over the current settings and re-validated. | `Only the host can change settings.` · `Settings are locked once the game starts.` · `Settings must be an object.` · `Winning target must be a whole number between 10000 and 1000000.` · `Start cash must be a whole number between 5000 and 100000.` · `Round limit must be 30, 50 or unlimited (null).` · `Dice must be 'lucky' or 'fair'.` · `Auction on decline must be true or false.` · `Snatch tokens must be a whole number between 0 and 3.` · `Snatch window must be between 1000 and 10000 ms.` · `Players must be between 2 and 6.` · `There are already more players than that.` |
| `kick` | `id`: user id | host, lobby only. Removes the player and bans them for 10 minutes. | `Only the host can remove players.` · `Players can only be removed in the lobby.` · `That player is not in the room.` · `You cannot remove yourself.` |
| `start` | | host, lobby, at least `minPlayers` (2) seated | `Only the host can start the game.` · `The game has already started.` · `You need at least 2 players to start.` · `Too many players for this room.` · `Could not start the game.` |
| `action` | `action`: object (8.5) | any member while `status 'playing'` | `No game is in progress.` · `Invalid action.` (failed the allow-list) · the engine's reason (for example `Not your turn`) |
| `chat` | `text?` (<= 200 chars, control characters stripped), `emote?` (one of `emote_mass emote_cheer emote_shock emote_laugh emote_thanks emote_hurry emote_taunt`) | any member, any status. At most one message per 700 ms per user; floods and empty messages are **silently dropped** | none |
| `leave` | | any member. Lobby: removed from the room (host passes on). Playing: resigns, seat marked `left`. Sockets are closed with 1000. | none |

Common errors for everything except `ping`: `You are not in this room.` (sender is not a member) · `This game is no longer available.` · `Unknown message type.`
(this also answers the retired `addBot` / `removeBot`).

**Legacy, accepted but not used by the shipped client:** `{t:'ready', ready:boolean}` (lobby only; `The game has already started.` / `Invalid ready value.`) sets the
`ready` flag shown in `room.players`; `{t:'visibility', visibility:'private'|'public'}` (host, lobby only; `Only the host can change who can see this room.` /
`Visibility is locked once the game starts.` / `Visibility must be private or public.`). Starting never requires anyone to be ready. See section 14.

### 8.3 Server -> client

| `t` | Payload | When |
|---|---|---|
| `pong` | | reply to `ping` |
| `room` | `room` (below) | on every join, leave, disconnect, reconnect, settings change, kick, start, game over and abandon. Not after every action. |
| `state` | `state`, `events`, `seq` | after every applied action (to every socket, each with its own redacted view), and once to a socket that connects while a game exists (`events: []`). Exception: a sealed `SNATCH` press that leaves the window open is **not broadcast** and does not change `seq`; only the presser receives a snapshot (`events: []`, same `seq`) so their button locks. |
| `error` | `message` | a rejected request (8.2), a refused join (8.1) or `This room has expired.` |
| `chat` | `id`, `from` (user id), `name`, `text`, `emote`, `ts` (ms) | every accepted chat message, to all sockets including the sender |
| `kicked` | | to the removed player's sockets, just before they are closed |

**`room` view:**
```
{ code, status: 'lobby'|'playing'|'finished', hostId, maxPlayers, gameId, visibility: 'private'|'public',
  settings,                      // the engine's full normalised cfg (see 2)
  players: [{ id, name, avatar, ready, connected }] }   // join order; `ready` is legacy (host true, others false unless a client sent `ready`)
```
`connected` = the user has at least one open socket. There is no `isBot`. A finished room whose game was abandoned still says `finished`.

### 8.4 The `state` shape (everything the client receives)

```
state = {
  cfg: { startCash, goal, passStart, jailTurns, bailFine, maxRounds: number|null, dice: 'lucky'|'fair',
         auctionOnDecline, snatches, snatchMs },
  rng: 0, deck: [], deckPos: number,              // rng and deck are server secrets: always sent as 0 / [] (8.7)
  round, turn /*index into players*/, turnCount,
  phase: 'roll'|'buy'|'snatch'|'auction'|'manage'|'debt'|'over',
  extraRoll: boolean, dice: [d],                  // [0] = no roll yet
  owners: (playerId|null)[40], levels: number[40] /*0-5*/, mortgaged: boolean[40],
  pending: null | buy | snatch | auction,         // shapes below
  trade: null | { id, from, to, give:{cash,tiles[]}, get:{cash,tiles[]} },   // `give` leaves `from`, `get` leaves `to`
  debt:  null | { player, amount, creditor: playerId|null, reason, returnPhase, rest: [{from,to,amount,reason}] },
  tradeSeq,
  traps: [{ tile, owner }],                       // SECRET: each viewer receives only their own (13.3)
  event: null | { id, title, text, kind, round, group?, mult?, amount? },   // the current city event (11)
  winner: playerId|null, winReason: 'last_standing'|'net_worth'|'rounds'|null,
  players: [{ id, name, avatar, color, isBot /*always false online*/, bot /*null*/,
              cash, pos, jailTurns, jailCards, sixes, rollsSinceSix, rentStreak, rentThisTurn, lastOfferTurn,
              snatches /*tokens, public*/, laps /*times START was passed, public*/, traps /*traps still in hand, public*/,
              bankrupt,
              stats: { rentPaid, rentEarned, taxPaid, propertiesBought, upgrades, jailed, biggestRent } }]
}
```

`pending` shapes:
```
buy:     { type:'buy', tile, price }
snatch:  { type:'snatch', tile, buyer, price, eligible: playerId[], claims: playerId[] /*redacted*/, ms, returnPhase:'manage' }
auction: { type:'auction', tile, minBid, bids: { [playerId]: amount } /*other players' amounts redacted to 0*/,
           // snatch bidding only:
           snatch?: true, buyer?, claimants?: playerId[], returnPhase? }
```
The client does not receive an "options" object: it computes `getOptions(state, me)` from `shared/engine.js` on the (redacted) view.
Its keys: `roll bail buy skipBuy shield endTurn upgrade[] bid mortgage[] unmortgage[] sellBuilding[] debt payDebt useJailCard trap trade tradeOffer tradeSent sets[] snatch snatched resign`
(everything false / null / [] when it is not that player's moment).

`seq` starts at 1 when the game starts and grows by one per applied action (a player's, an auto-played one, or the server's `SNATCH_CLOSE`). Rejected actions and still-open sealed `SNATCH` presses do not change it.
The state in every `state` message is the **full** state, never a delta.

### 8.5 Client actions (allow-list in `worker/validate.js` `sanitizeAction`)
`playerId` is always overwritten with the socket's user; unknown fields are dropped; anything not listed (including `SNATCH_CLOSE`) fails with `Invalid action.`
Legality is then decided by the engine (its message is sent back as `error`).

| `type` | Fields | Legal when | Engine errors (selection) |
|---|---|---|---|
| `ROLL` | | your turn, phase `roll`, or `manage` with `extraRoll` | `Not your turn` · `Decide about the property first` · `An auction is in progress` · `You already rolled. End your turn` |
| `PAY_BAIL` | | your turn, phase `roll`, in jail, cash >= 500 | `You are not in jail` · `Bail costs ₹500` · `You can only pay bail before rolling` |
| `USE_JAIL_CARD` | | as above, holding the card | `You have no Get Out of Jail Free card` |
| `BUY` | `shield?: true` | your turn, phase `buy`, cash >= price. `shield` also needs a token and another active player holding one. | `Nothing to buy right now` · `Not enough cash` · `You have no Snatch token to shield with` · `Nobody could snatch it, no need to shield` |
| `SKIP_BUY` | | your turn, phase `buy` | `Nothing to skip right now` |
| `PLACE_TRAP` | `tile` (int 0-39) | your turn, phase `roll`, you hold a trap | `You can only set a trap before you roll` · `You have no trap left` · `You cannot trap that square` |
| `UPGRADE` | `tile` | your turn, `roll`/`manage`, full colour, even building, cash >= `houseCost`, nothing mortgaged in the colour | `Own all of <colour> to build here` · `Build evenly: ...` · `Already fully built (Hotel)` · `Need ₹X more` ... |
| `MORTGAGE` | `tile` | your tile, colour without buildings, `roll`/`manage` of your turn or your own debt | `Sell the buildings in this colour first` · `Already mortgaged` |
| `UNMORTGAGE` | `tile` | your mortgaged tile, `roll`/`manage` of your turn, cash >= cost | `This tile is not mortgaged` · `Need ₹X more` |
| `SELL_BUILDING` | `tile` | your tile with buildings, tallest of its colour first | `Nothing built here` · `Sell evenly: ...` |
| `PAY_DEBT` | | you are the debtor, cash >= amount | `You do not owe anything right now` · `This is not your debt` |
| `END_TURN` | | your turn, phase `manage`, no `extraRoll` | `You cannot end your turn yet` · `You rolled a six. Roll again` |
| `BID` | `amount` (int 0 - 100,000,000; 0 = pass) | auction, once per player | `There is no auction right now` · `You already placed your bid` · `The minimum bid is ₹X` · `You cannot bid more than your cash` |
| `TRADE_OFFER` | `to` (user id, not you), `give`/`get`: `{cash:int>=0, tiles:int[]}` (unique, on board, not both empty) | your turn, `roll`/`manage`, nothing pending | `Finish the current step before trading` · `Pick another active player to trade with` · `You do not have that much cash` · `Sell the buildings in <colour> before trading <tile>` |
| `TRADE_ACCEPT` / `TRADE_REJECT` | | the recipient of the pending offer | `There is no trade offer` · `This offer is not for you` |
| `TRADE_CANCEL` | | the offerer | `Only the player who made the offer can cancel it` |
| `SNATCH` | | an eligible player who has not pressed (9.4) | `There is nothing to snatch` · `You cannot snatch this one` · `You already pressed Snatch` |
| `RESIGN` | | any non-bankrupt player, any time (7.4) | `You are out of the game` |

While a trade is pending only the three trade answers and `RESIGN` are legal (`A trade offer is waiting for an answer`); while the phase is `debt`
see 7.2; while it is `snatch` only `SNATCH` and `RESIGN` (`Wait for the snatch window`). After the game ends: `The game is over`.

### 8.6 Events (`events` in a `state` message, replayed by the client presenter and written to the log)

| `type` | Fields |
|---|---|
| `dice` | `player, values:[d], assist: null\|'comeback'\|'mercy'\|'pity'\|'antibust'` |
| `move` | `player, from, to, path: tile[] (excluding from), passedStart, teleport?` |
| `land` | `player, tile` |
| `cash` | `player, delta (signed), reason, other?` - reasons `salary rent tax buy upgrade auction card bail liquidate mortgage unmortgage sell trade event` (a transfer emits one event per side; `other` = counterparty) |
| `own` | `tile, owner (id\|null), reason: 'buy'\|'auction'\|'snatch'\|'trade'\|'bankrupt'` |
| `level` | `tile, level, reason: 'upgrade'\|'sell'\|'bankrupt'` |
| `jail` | `player, jailed: boolean, reason` - `gotojail card trap` (jailed) · `six bail served card_used` (released) |
| `jail_stay` | `player, left` |
| `card` | `player, cardId, kind: 'good'\|'bad'\|'neutral', deck: 'chance'\|'chest', title, text` |
| `auction_start` | `tile, minBid, reason?: 'snatch', eligible?` |
| `auction_end` | `tile, winner (id\|null), amount, bids: {id: amount}` (reveals every bid), `reason?: 'snatch', buyer?` |
| `snatch_open` | `tile, buyer, price, eligible, ms` |
| `snatch_end` | `tile, buyer, outcome: 'none'\|'snatched'\|'bidding', winner?, claimants?` |
| `snatch_token` | `player, snatches` (a token was spent) |
| `shield` | `player, tile` |
| `token_earned` | `player, reason: 'lap'\|'chai', snatches` |
| `city_event` | `id, title, text, kind, round, group?, mult?, amount?` |
| `trap_placed` | `player` (never names the tile) |
| `trap_sprung` | `tile, owner, victim` |
| `mortgage` / `unmortgage` | `player, tile, value` / `player, tile, cost` |
| `set_complete` | `player, group` (a colour was completed; held back until a Snatch window closes) |
| `debt` | `player, amount, creditor` |
| `bankrupt` | `player` |
| `trade_offer` / `trade_done` | `id, from, to, give, get` |
| `trade_rejected` | `id, from, to, reason: 'rejected'\|'cancelled'\|'bankrupt'\|'invalid'` |
| `turn` | `player, round` |
| `win` | `player (id\|null), reason, worth` |

### 8.7 Redaction (what each viewer is not told)
`worker/mask.js` (`adapter.redact`) runs for every recipient. It always returns a copy with the engine secrets removed (one stripped copy is cached per authoritative state), so each socket gets its own payload.
* **Sealed bids:** while `pending.type === 'auction'`, `pending.bids` keeps every key but shows `0` for every player except the viewer (so "has bid" is visible, the amount is not).
  `auction_end.bids` reveals all amounts.
* **Snatch presses:** while `pending.type === 'snatch'`, `pending.claims` is `[viewerId]` if the viewer pressed, else `[]`. Presses emit no event; `snatch_end.claimants` reveals the pressers at the close. Once snatch bidding starts,
  `pending.claimants` is public (a claimant who passes with 0 is still recognised).
* **Traps:** `state.traps` is cut down to the viewer's own; `trap_placed` does not name the tile, `trap_sprung` does.
* **Engine secrets:** `state.rng` is sent as `0` and `state.deck` as `[]`, so a client cannot compute the next die, card or city event (nothing in the client reads them). `deckPos` is still sent.
* Public: `player.snatches`, `player.laps`, `player.traps` (count in hand), `jailCards`, all cash and properties.

### 8.8 Timers, auto-play and presence (server side, Durable Object alarms)
* **Decision timer, 45 s (`TURN_MS`).** Everyone the game is waiting for (the turn player; the debtor in a debt; every player who has not bid in an auction; the recipient and the
  offerer of a pending trade) gets 45 s, counted from when the client animation of the last applied action ends (`lastApplyAt + animationMs`; the clock restarts after every applied
  action, including other players' bids). Animation estimate: dice 900 ms, 170 ms per step moved, card 1,500, `auction_end` and `city_event` 1,500, `trap_sprung` 900, `win` 2,500, capped at 6 s; the game start adds 1.5 s.
* When it fires the player is flagged **idle** and the engine's move chooser plays one move for them. An idle player is auto-played ~900 ms per move (~400 ms for bids, never faster than the animation) until they send any `action`
  (or reconnect), which clears the flag.
* **Disconnect grace, 15 s.** A member with no open socket is auto-played once 15 s have passed since the last socket closed (or since a restart noticed it). Reconnecting cancels it.
* **Trade, 30 s.** A pending trade offer is auto-rejected (`TRADE_REJECT` for the recipient) 30 s after it appears. If the recipient is out of the game the offerer's offer is cancelled after 0.9 s.
* **Snatch window, `pending.ms` (3 s default) + 400 ms grace** (`SNATCH_GRACE_MS`, so a press sent at the end of the client countdown still arrives). Started when the `snatch_open` state is sent. The room issues `SNATCH_CLOSE` when it ends; derived from state, so it survives eviction. Nobody is auto-played in it.
* What auto-play does (`idleAction`): in a snatch window nothing; a pending trade is rejected / cancelled; otherwise the engine's move chooser: buys when its heuristic likes the tile else skips, bids, lifts mortgages and builds when rich,
  pays bail / uses the jail card, rolls, ends the turn, settles debts (mortgage cheapest first, sell buildings last). It never snatches, shields, sets a trap or proposes a trade.
* **Safety net:** if the engine refuses three automated moves in a row for the same player, that player is resigned; if resigning is not possible the game is called off (finished, abandoned).
* **Lobby:** a member with no socket for 60 s is dropped from the lobby (host passes on); a lobby with no players left expires in about 10 minutes.
* **Abandon:** no non-left member connected for 5 minutes (or every seat has left) while playing: `status 'finished'`, not recorded.
* **Expiry:** 24 h after the last activity the room sends `error` `This room has expired.`, closes all sockets (4004) and deletes itself and its listing row.
* **Persistence:** the whole room record is in Durable Object storage after every change. When a game ends the match is written to Neon once (retries after 2 s, 10 s, 30 s, 2 min, then every 10 min, at most 8 attempts; an abandoned game is never written).
* Per-user limits: 3 sockets per room; chat 1 message / 700 ms.

### 8.9 Reconnect and resync
* The client socket (`src/lib/socket.js`) reconnects with exponential backoff (about 0.5 s to 8 s, jittered), also on `online` and tab-visible events, and stops for close codes 1008, 4001, 4003, 4004, 4009.
* On every (re)connect the server sends `room` (to everyone) and then the current redacted `state` with `events: []` to the new socket. The client treats the first state after a connect as a **snapshot**
  (`fresh`): it resets the presenter instead of animating, so nothing plays twice. A `room` message with `status 'lobby'` resets the client's `seq` tracking.
* There is **no resync request**: every `state` is the full state, so a missed message only costs the animation of its events. The client ignores a `state` whose `seq` is not newer than the last one it saw (unless it is a snapshot).
* The snatch UI reads the latest state, not the animation queue (9.10). A rejected action releases the client's "waiting for the server" lock (also after 5 s with no answer).
* A member who disconnects keeps their seat for the whole game (lobby: 60 s).

### 8.10 HTTP endpoints of the pre-game flow
All JSON, same origin, cookie session; errors are `{ "error": "message" }`. (Full API table: README.)

| Endpoint | Auth | Behaviour |
|---|---|---|
| `GET /api/games` | none | `{ games:[{ id, name, minPlayers, maxPlayers, openTables }] }`, cached 5 s |
| `POST /api/rooms` `{ gameId?, settings?, maxPlayers?, visibility? }` | signed in (guest or Google), 10 / min | Creates a room, returns `201 { code, gameId }`. Missing `gameId` = `hyderabad-tycoon`. `maxPlayers` (2-6, default 4) may also be inside `settings`. `visibility` `private` (default) \| `public`. Settings are validated by the adapter, then again by the room. Errors `400`: `unknown game` · `Visibility must be private or public.` · `Settings must be an object.` · `Players must be between 2 and 6.` · the settings messages of 8.2. `502 Could not create the room.` / `503 Could not allocate a room code, please try again.` (up to 8 code collisions are retried). |
| `GET /api/rooms/:code` | optional | `{ code, exists, status, players (count), maxPlayers, hostName, isMember, gameId, visibility, settings }` (zeros / nulls and `exists:false` for an unknown room). `400 Room codes are 6 letters/numbers.` Used by the Join page and by the client to diagnose a failing socket. |
| `GET /api/rooms/mine` | signed in | `{ rooms:[{ code, gameId, status:'lobby'\|'playing', players, maxPlayers }] }` (rooms I am a member of, newest first) |
| `GET /api/rooms/open?game=<id>&limit=20` | none | public lobbies with a free seat, active in the last hour. Not used by the current UI. |
| `POST /api/invites` `{ code, userId }` | signed-in, non-guest | the inviter must be a member of a lobby and a friend of `userId`; pushes `{t:'invite', from, code, gameId, gameName}` to that friend's `/ws/user` |

Pre-game flow: game page (`/games/:gameId`: pick players, **Create table**) -> `POST /api/rooms` -> `/lobby/:code` (open the socket: connecting seats you) -> host adjusts the end cash limit (`settings`) and presses
**Start** (`start`) -> everyone navigates to `/play/:gameId/online/:code` when `room.status` becomes `playing`. A finished room offers "New room, same settings" (a fresh `POST /api/rooms`); a game cannot be restarted in the same room.

## 9. Snatch **[contract]**

### 9.1 Idea
Every player starts with `cfg.snatches` (default **1**) **Snatch tokens**. When a player **buys** a
property, the other players with a token get a **3 second** window (`cfg.snatchMs`, plus a 400 ms server grace) to hit **Snatch**.

### 9.2 When a window opens
Only after a successful `BUY` of a free tile on landing (property, station or utility), without Shield. It does NOT
open for auction wins, trades, card effects or mortgage changes. It opens only if at least one player is
**eligible**: not the buyer, not bankrupt, `snatches > 0`. Otherwise the buy completes normally.

### 9.3 State
```
player.snatches: number                       // public, shown to everyone
phase: 'snatch'
pending: {
  type: 'snatch',
  tile: number, buyer: playerId, price: number,   // price the buyer paid
  eligible: playerId[],                           // fixed when the window opens
  claims: playerId[],                             // REDACTED: a viewer only ever sees [] or [viewerId]
  ms: number,                                     // = cfg.snatchMs
  returnPhase: 'manage'                           // phase to restore (same rule as debt.returnPhase)
}
options.snatch   = { tile, ms } | null            // computed by getOptions on the client: truthy only for an eligible player who has not pressed
options.snatched = true | undefined               // eligible player who already pressed (UI: "locked in")
```
The buyer has already paid and already owns the tile in the state during the window (so a crash or
reconnect can never lose the purchase); resolution moves it if needed.

### 9.4 Actions
* `{ type: 'SNATCH' }` (client). Valid only in phase `snatch`, by an eligible player who has not
  pressed. Errors: `There is nothing to snatch`, `You cannot snatch this one`, `You already pressed
  Snatch`. Pressing is **sealed**: it emits no event, is not broadcast and does not change `seq` (only the presser gets a snapshot, 8.3). If after the press every eligible player who is still in the game has
  pressed, the window resolves immediately (same code path as the timer).
* `{ type: 'SNATCH_CLOSE' }` (server only, carries no player). Issued by the room when the timer fires. The adapter's
  `sanitizeAction` rejects it from clients. The engine rejects it outside phase `snatch` (`There is nothing to snatch`).
* While the phase is `snatch`, every other action is rejected with `Wait for the snatch window` except
  `SNATCH` and `RESIGN` (a resigning claimant is removed from `claims`; a resigning buyer: see 7.4), plus chat/emotes.

### 9.5 Resolution (`SNATCH_CLOSE`, or the last eligible press)
Let `C = claims` (bankrupt players dropped; empty if the tile now belongs to somebody other than the buyer or the bank).
* **|C| = 0**: nothing happens, the buyer keeps the tile. Phase returns to `returnPhase`.
* **|C| = 1** (player S): the tile moves to S **for free**, S spends **1** token. **The buyer is NOT
  refunded**: the price they paid stays paid. Phase returns to `returnPhase`.
* **|C| >= 2**: **sealed bidding** among exactly the claimants. Reuse the auction machinery: `phase =
  'auction'`, `pending = { type:'auction', tile, minBid, bids, snatch: true, buyer, claimants: playerId[], returnPhase }` (`claimants` is public from this point on, so a claimant who passes with 0 is still recognised as one) with
  `bids[q] = 0` pre-filled for every non-claimant and every claimant who cannot afford `minBid` (so they auto-pass). `minBid` is the same minimum as a
  skipped-tile auction. The winner pays the bid to the bank, receives the tile, and spends **1** token;
  losing claimants keep their tokens (a token is spent only by whoever ends up with the tile). If nobody
  places a valid bid the tile stays with the buyer and no token is spent. The buyer is never refunded and
  never takes part.

### 9.6 Events (server -> clients, public, in `events`)
```
{ type: 'snatch_open', tile, buyer, price, eligible: playerId[], ms }
{ type: 'snatch_end',  tile, buyer, outcome: 'none' | 'snatched' | 'bidding',
                       winner?: playerId,            // outcome 'snatched'
                       claimants?: playerId[] }      // outcome 'snatched' (1) or 'bidding' (>=2); revealed only now
{ type: 'own',  tile, owner, reason: 'snatch' }      // 'auction' for snatch bidding
{ type: 'auction_start', tile, minBid, reason: 'snatch', eligible: playerId[] }   // existing event, extra fields
{ type: 'auction_end', ..., reason: 'snatch', buyer }                              // existing event, extra fields
{ type: 'snatch_token', player, snatches }           // after a token is spent (public)
```
No event is ever emitted for an individual press (sealing). `set_complete` for the winner of the tile (or for the buyer when they keep it) is emitted after the window resolves.

### 9.7 Timers and persistence
`adapter.deadlines(state)` returns, while `phase === 'snatch'`:
`{ key: 'snatch:<turnCount>:<tile>', afterMs: pending.ms + SNATCH_GRACE_MS (400), playerId: pending.buyer, action: { type: 'SNATCH_CLOSE' } }`.
The timer survives Durable Object eviction (it is derived from state, like the trade timer). While the
phase is `snatch`: `turnPlayerId` = the buyer, `pendingPlayerIds` = `eligible` players who have not pressed
(the idle watchdog must not auto-play anyone), `idleAction` = null,
`animationMs([...])` adds nothing (the window is real time and starts when the state is sent).

### 9.8 Redaction
See 8.7.
The viewer's own `options.snatched` comes from their own claim. Nobody can learn another player's press before the close.

### 9.9 Auto-play and the simulator
Idle / disconnected auto-play never snatches (tokens simply stay unspent). The simulator's bots (`scripts/simulate.js`, `botSnatchAction` in `shared/bots.js`) may
snatch with a trivial policy (snatch when the tile completes the bot's colour set or costs >= 1,500),
purely so the simulation exercises the code.

### 9.10 Client rules **[contract]**
* The snatch UI is driven by the **latest authoritative state** (`session.view`), NOT the delayed
  animation `display`: the window is real time and must never be eaten by the presenter's queue.
  When a state arrives (new `seq`) with `pending.type === 'snatch'`, record `receivedAt = performance.now()`
  and count down `pending.ms` from it. Never trust the client clock for the result, the server decides.
  A `SNATCH` press is sent immediately (not blocked by `busy` / the awaiting lock) and at most once per window.
* Eligible player (`options.snatch`): show a large **SNATCH!** button (the primary action, >= 44 px,
  Space/Enter shortcut) with a depleting ring, the tile name/price and "free, the buyer keeps paying".
  After pressing: disabled "Snatch locked in" state (from `options.snatched`).
* Everyone else (buyer, players without a token): status line "<buyer> bought <tile>. Snatch window...",
  with the same countdown, no button.
* The board highlights the contested tile with a pulsing ring. The scoreboard shows each player's token
  count (lightning icon x n). Results appear in the log: see 9.11.
* Snatch bidding reuses the existing auction sheet (only claimants see the bid form; others see "Snatchers
  are bidding for <tile>").

### 9.11 Log lines (`src/lib/messages.js`)
* `snatch_open`: "<Buyer> bought <Tile> for <price>. Snatch window open (3s)!"
* `snatch_end` none: "Nobody snatched. <Tile> stays with <Buyer>."
* `snatch_end` snatched: "<Winner> SNATCHED <Tile> from <Buyer> for free! (<Buyer> still paid <price>)"
* `snatch_end` bidding: "<A> and <B> both snatched! Sealed bidding for <Tile>."
* auction end with `reason: 'snatch'` and no winner: "Nobody bid. <Tile> stays with <Buyer>."

### 9.12 Test matrix (`shared/snatch.test.js`, `worker/snatch.test.js`)
No eligible player -> no window; 1 claimant -> transfer, token spent, buyer cash unchanged by the snatch;
2 and 3 claimants -> bidding among claimants only, winner pays bid + spends token, losers keep tokens,
no-bid -> buyer keeps; press twice -> error; buyer cannot snatch; no-token player cannot; non-snatch
action during the window -> error; early close when all eligible pressed; `SNATCH_CLOSE` from a client is
rejected by `sanitizeAction`; redaction hides other players' presses; snatch after a six keeps the extra roll;
resigning claimant; bankrupt players are never eligible; tokens public; deadlines() shape; determinism
(same seed + same actions = same result).

## 10. Tokens: Shield and earning more **[contract]**

One currency: `player.snatches` (shown as Snatch tokens, cap **TOKEN_CAP = 3**, in `shared/board.js`). A token can be
spent on a Snatch (section 9) or on a **Shield**. Every rule here is off when `cfg.snatches === 0` (nobody starts with tokens and nobody can earn any).

### 10.1 Shield
* `{ type: 'BUY', shield: true }`. Buys exactly like BUY, then spends **1** token and **no Snatch window opens** for this purchase.
* Valid only if the buyer has a token AND at least one other active player has a token. Errors:
  `You have no Snatch token to shield with` / `Nobody could snatch it, no need to shield`.
* `getOptions` adds `options.shield = true` in the buy phase when both conditions hold (and the buyer can afford the tile).
* Events: the usual buy events, then `{ type: 'shield', player, tile }` and `{ type: 'snatch_token', player, snatches }`.
  The set celebration (`set_complete`) fires immediately (nothing can change hands).
* Idle auto-play never shields.

### 10.2 Earning tokens
* Every **3rd** time a player passes or lands on START (`player.laps` counts passes; `LAPS_PER_TOKEN = 3`) they earn **+1**.
* Landing on **Irani Chai & Biryani Break** (tile 20), by dice or by a card, earns **+1** (not if a trap sprang there first).
* Earning never exceeds TOKEN_CAP (silent at the cap: no event, and the lap still counts).
  Event: `{ type: 'token_earned', player, reason: 'lap' | 'chai', snatches }`.

## 11. City events **[contract]**

`shared/events.js` exports `CITY_EVENTS` and `EVENT_EVERY = 5`. When the round counter rises to a multiple of EVENT_EVERY
(5, 10, 15, ...) a random event (seeded rng, so deterministic) is drawn and lasts until the next round starts. There is never an event in round 1.
`state.event = null | { id, title, text, kind, group?, mult?, amount?, round }`; it is public and cleared when the next
round begins. Event: `{ type: 'city_event', ...same fields }` (emitted before that round's first `turn` event).

| id | effect during the round |
|---|---|
| monsoon | one colour group (random among groups somebody owns, else any group) pays **half** rent |
| ipl | one colour group (same pick) pays **double** rent |
| metro_strike | stations pay **no** rent |
| tax_holiday | GHMC property tax and the ORR challan cost **0** |
| bonalu | every active player gets **+500** once, at the start of the round (cash reason `event`) |

`kind` is `rent` (monsoon, ipl, metro_strike), `tax` (tax_holiday) or `cash` (bonalu); `group` + `mult` (0.5 | 2) only for monsoon/ipl, `amount` only for bonalu.

Rent changes apply through `rentOf`, so `previewRent`, the odds overlay and the UI all agree. A mortgaged tile still pays 0.

## 12. UI contract for sections 10 and 11
* Action bar in the buy phase: a second button **Buy + Shield** (`{ type: 'BUY', shield: true }`, shows the token) next to
  Buy, shown when `options.shield`.
* A **city event banner** (title, one line, the affected colour chip) is shown while `view.event` is set, in the control
  panel and announced via aria-live; the affected group's tiles get a subtle ring on the board.
* Log lines: `city_event` "<title> <text>", `shield` "<Player> shielded <Tile>: no snatching!", `token_earned`
  "<Player> earned a Snatch token (lap bonus | Chai break)". Cash reason `event`: "Festival gift".
* Rules sheet: a "Tokens, Shield and city events" section. The player sheet shows lap progress ("2/3 laps to a token").

## 13. Traps **[contract]**

Every player starts with **1 trap** (`TRAPS_EACH = 1`, in `shared/board.js`). There is no fine: a sprung trap throws the victim in jail.

### 13.1 Placing
* `{ type: 'PLACE_TRAP', tile }`. Only the turn player, only in phase `roll` (their turn, **before rolling**; this includes a
  jailed player). Any tile **except Go to Jail (30)**. A player can have only as many traps on the board as they were given
  (so one; the count in hand never refills), and cannot put a second trap on a tile where they already have one.
* Errors: `Not your turn`, `You can only set a trap before you roll`, `You have no trap left`, `You cannot trap that square`.
* Placing does not end the turn: the player still rolls afterwards. Idle auto-play never places traps.
* `getOptions` adds `options.trap = true` when placing is possible right now.

### 13.2 Springing
* A trap springs when a player **other than its owner lands** on its tile (stops there; passing over does nothing; landing through a card move counts,
  a teleport to jail does not). It springs before the tile's own effect (rent, tax, card, buy offer, Chai token).
* Effect: the victim is **thrown in jail**: moved to Chanchalguda Jail exactly like Go to Jail (no salary, the turn ends, any
  extra roll is lost, jail event reason `trap`), and the tile's own effect is skipped. The trap is then **removed** (one-shot). The owner is immune and their trap stays until someone else lands on it. If two players have traps
  on the same tile, both are removed (the victim goes to jail once).
* A bankrupt player's traps are removed.

### 13.3 State, secrecy and events
* `state.traps = [{ tile, owner }]` is **secret**: `redact(state, viewer)` keeps only the viewer's own traps (anybody who is not a player sees none).
* `player.traps` = traps still in hand (public, 0 or 1). So everyone can see who has already set theirs, nobody sees where.
* Events (identical for everybody, so they never reveal the tile before it springs):
  `{ type: 'trap_placed', player }` and `{ type: 'trap_sprung', tile, owner, victim }` (this one reveals the tile),
  followed by the usual jail events (`move` with teleport, `jail` with reason `trap`). No cash changes hands.
* Old saved states without `traps` / `player.traps` behave as no traps.

### 13.4 UI contract
* While `options.trap` is true the control panel shows a hint under the Roll button: "Tap any tile to set your trap" with a
  trap icon. Tapping a tile opens its deed; the deed shows a **Set trap here** button (`{ type: 'PLACE_TRAP', tile }`).
* The board shows the viewer's own traps (a small warning-triangle badge, "your trap" in the label). Nobody else's.
* Log: `trap_placed` "<Player> set a trap somewhere...", `trap_sprung` "<Victim> walked into <Owner>'s trap on <Tile> and was thrown in jail!". Rules sheet gets a "Traps" paragraph. The scoreboard shows a trap icon for players who still hold theirs.

## 14. Known discrepancies (code vs contract; open items, not hidden)

(Fixed during this audit and no longer listed: `state.rng` / `state.deck` used to be sent to clients unmasked; `worker/mask.js` now zeroes them, see 8.7.)

1. **Rank 1 can differ from the winner on a rounds finish.** The `rounds` win breaks a net-worth tie by most cash (`shared/engine.js:919-933`), but `standings()` breaks it by seat
   (`shared/engine.js:199-203`), and `result()` ranks from `standings()` (`worker/games/hyderabad-tycoon.js:258-283`). The winner can be recorded as rank 2 (affects Elo, XP and the podium order).
   Bankrupt players are also ranked by seat among themselves, not by when they went out.
2. **`ready` and `visibility` messages are still live on the server although the product has neither.** `worker/GameRoom.js:466-471` and `:510-545` (and `ready` in `roomView`, `:175`) are
   unreachable from the shipped UI; the header comment (`:6-7`) still says players "ready up". Harmless, but the dead handlers and the `ready` field in `room.players` should either go or be documented as API.
3. **Kick wording.** The kick dialog says the player "can rejoin with the code" (`src/pages/Lobby.jsx:267`), but the server bans a removed player for 10 minutes (`worker/GameRoom.js:34`, `:555`, `:385-386`).
4. **A player who left a running game is un-flagged on reconnect.** `handleUpgrade` clears `member.left` (`worker/GameRoom.js:399`); the player is already bankrupt, but they reappear in "Continue playing" (`memberIds` filters on `left`, `worker/roomsdb.js:106`)
   and count as present for the abandon check.
5. **Rules text offers a setting the lobby does not.** The lucky-dice help text says "The host can switch to Fair dice" (`src/components/game/ui/helpers.js:175`), but the lobby only exposes the end cash limit.
6. Comments only: `src/lib/socket.js:8` and `src/lib/session/useOnlineGame.js:26` still use `{t:'ready'}` as their example message.
