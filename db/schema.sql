-- Hyderabad Tycoon schema. Idempotent: safe to run any number of times
-- (`node scripts/migrate.js`). Only CREATE ... IF NOT EXISTS statements.
-- Statements are separated by semicolons at the end of a line; keep it that way
-- (the migration script splits on ";" - no procedural blocks / dollar quoting here).

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text UNIQUE,
  email       text,
  name        text NOT NULL,
  avatar      integer NOT NULL DEFAULT 0 CHECK (avatar BETWEEN 0 AND 11),
  friend_code text NOT NULL UNIQUE,
  is_guest    boolean NOT NULL DEFAULT false,
  xp          integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  coins       integer NOT NULL DEFAULT 500 CHECK (coins >= 0),
  level       integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  games       integer NOT NULL DEFAULT 0,
  wins        integer NOT NULL DEFAULT 0,
  best_worth  integer NOT NULL DEFAULT 0,
  rent_earned bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_leaderboard_idx
  ON users (wins DESC, best_worth DESC)
  WHERE is_guest = false AND games > 0;

CREATE INDEX IF NOT EXISTS users_guest_last_seen_idx
  ON users (last_seen)
  WHERE is_guest = true;

-- One row per pair of users. user_id = the requester, friend_id = the recipient.
-- 'pending' until the recipient accepts (or sends a request back: mutual = accepted).
CREATE TABLE IF NOT EXISTS friendships (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

-- Guarantees a single row per unordered pair (A,B) / (B,A).
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uniq
  ON friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

CREATE INDEX IF NOT EXISTS friendships_friend_idx
  ON friendships (friend_id, status);

CREATE TABLE IF NOT EXISTS matches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code    text NOT NULL,
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz NOT NULL DEFAULT now(),
  rounds       integer NOT NULL DEFAULT 0,
  winner_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  win_reason   text,
  goal         integer,
  max_rounds   integer,
  dice_mode    text,
  player_count integer NOT NULL
);

-- Upgrades for databases created before these columns existed (no-ops on a fresh schema).
-- rounds = rounds played; goal = winning net-worth target; max_rounds = round limit (NULL = unlimited).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS rounds integer NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS goal integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_rounds integer;
-- dice_mode = 'lucky' | 'fair' (rules v2).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS dice_mode text;

CREATE INDEX IF NOT EXISTS matches_ended_idx
  ON matches (ended_at DESC);

CREATE INDEX IF NOT EXISTS matches_winner_idx
  ON matches (winner_id)
  WHERE winner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS match_players (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id    uuid NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  name        text NOT NULL,
  is_bot      boolean NOT NULL DEFAULT false,
  rank        integer NOT NULL,
  final_worth bigint NOT NULL DEFAULT 0,
  rent_earned bigint NOT NULL DEFAULT 0,
  hotels_built integer NOT NULL DEFAULT 0
);

ALTER TABLE match_players ADD COLUMN IF NOT EXISTS hotels_built integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS match_players_match_idx
  ON match_players (match_id);

CREATE INDEX IF NOT EXISTS match_players_user_idx
  ON match_players (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- GameHub marketplace (docs/MARKETPLACE.md section 6). Everything below is additive + idempotent.
-- ---------------------------------------------------------------------------------------------

-- Which game a match belongs to. Rows written by the old (Tycoon-only) version get the default.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'hyderabad-tycoon';

CREATE INDEX IF NOT EXISTS matches_game_idx
  ON matches (game_id, ended_at DESC);

-- Per-game numbers. users.xp / coins / level stay platform-wide. The legacy users.games / wins /
-- best_worth / rent_earned columns keep being updated for Tycoon so the previous version of the
-- app keeps working during a rollout. `rating` is a simple Elo-style number (see worker/rating.js).
CREATE TABLE IF NOT EXISTS user_game_stats (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game_id    text NOT NULL,
  games      integer NOT NULL DEFAULT 0,
  wins       integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  rating     integer NOT NULL DEFAULT 1000,
  extra      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS user_game_stats_rank_idx
  ON user_game_stats (game_id, wins DESC, rating DESC);

-- Overall leaderboard (ranked by xp).
CREATE INDEX IF NOT EXISTS users_xp_idx
  ON users (xp DESC)
  WHERE is_guest = false;

-- One-time backfill of Tycoon stats from the legacy users columns. Re-running it never overwrites
-- a row that already exists (ON CONFLICT DO NOTHING), so numbers kept up to date by the app win.
INSERT INTO user_game_stats (user_id, game_id, games, wins, best_score)
SELECT id, 'hyderabad-tycoon', games, wins, best_worth
  FROM users
 WHERE games > 0
ON CONFLICT (user_id, game_id) DO NOTHING;

-- Listing of live rooms (powers "Open tables" and "Continue playing" only). The room Durable Object
-- is the source of truth: it upserts its row on create / join / leave / settings / visibility /
-- start / finish and deletes it on expiry. Queries ignore rows older than 24 h.
-- member_ids = ids of the human members (so /api/rooms/mine does not need the Durable Object).
CREATE TABLE IF NOT EXISTS rooms (
  code         text PRIMARY KEY,
  game_id      text NOT NULL,
  host_id      uuid,
  host_name    text,
  visibility   text NOT NULL DEFAULT 'private',
  status       text NOT NULL DEFAULT 'lobby',
  player_count integer NOT NULL DEFAULT 1,
  max_players  integer NOT NULL DEFAULT 4,
  settings     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS member_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS rooms_listing_idx
  ON rooms (visibility, status, game_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS rooms_members_idx
  ON rooms USING gin (member_ids);
