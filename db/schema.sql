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
