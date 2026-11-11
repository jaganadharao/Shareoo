/*
# Sparkboard — community inspiration board

## What this does
Creates the data layer for "Sparkboard", an open community board where anyone
can post short ideas ("sparks"), upvote the ones they like, filter by category,
and search. No sign-in is required — the app is intentionally public/shared.

## New tables
1. `sparks`
   - `id` (uuid, primary key)
   - `title` (text, not null) — short headline of the idea
   - `body` (text) — optional longer description
   - `category` (text, not null) — one of a fixed allowlist of categories
   - `author_name` (text) — optional display name the poster chooses
   - `votes_count` (integer, default 0) — denormalized upvote count for fast sorting
   - `created_at` (timestamptz, default now())
2. `votes`
   - `id` (uuid, primary key)
   - `spark_id` (uuid, foreign key -> sparks.id, cascade delete)
   - `voter_id` (text, not null) — anonymous per-browser id stored in localStorage
   - `created_at` (timestamptz, default now())
   - unique constraint on (spark_id, voter_id) so each browser can vote once per spark

## Triggers
- `update_spark_votes_count` — after insert/delete on `votes`, recomputes
  `sparks.votes_count` so the board can sort by "hot" / "top" without a join.

## Security
- Row Level Security enabled on both tables.
- Because there is NO sign-in screen, all policies use `TO anon, authenticated`
  so the anon-key frontend can read and write the shared, public data.
- `USING (true)` is used intentionally: the data is community-shared by design.

## Notes
1. This is a single-tenant (no-auth) app. No `user_id` columns or `auth.uid()` checks.
2. Vote de-duplication is enforced by the unique(spark_id, voter_id) constraint,
   not by RLS — each browser generates a random `voter_id` stored in localStorage.
*/

CREATE TABLE IF NOT EXISTS sparks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  category text NOT NULL CHECK (
    category IN ('Product', 'Design', 'Startup', 'Life', 'Tech', 'Creative')
  ),
  author_name text,
  votes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_id uuid NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
  voter_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spark_id, voter_id)
);

CREATE INDEX IF NOT EXISTS sparks_created_at_idx ON sparks (created_at DESC);
CREATE INDEX IF NOT EXISTS sparks_votes_count_idx ON sparks (votes_count DESC);
CREATE INDEX IF NOT EXISTS sparks_category_idx ON sparks (category);
CREATE INDEX IF NOT EXISTS votes_spark_id_idx ON votes (spark_id);

ALTER TABLE sparks ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sparks" ON sparks;
CREATE POLICY "anon_select_sparks" ON sparks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sparks" ON sparks;
CREATE POLICY "anon_insert_sparks" ON sparks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sparks" ON sparks;
CREATE POLICY "anon_update_sparks" ON sparks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sparks" ON sparks;
CREATE POLICY "anon_delete_sparks" ON sparks FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_votes" ON votes;
CREATE POLICY "anon_select_votes" ON votes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_votes" ON votes;
CREATE POLICY "anon_insert_votes" ON votes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_votes" ON votes;
CREATE POLICY "anon_delete_votes" ON votes FOR DELETE
  TO anon, authenticated USING (true);

-- Recompute votes_count whenever a vote is added or removed.
CREATE OR REPLACE FUNCTION recompute_spark_votes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE sparks
      SET votes_count = (SELECT COUNT(*) FROM votes WHERE votes.spark_id = NEW.spark_id)
      WHERE id = NEW.spark_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE sparks
      SET votes_count = (SELECT COUNT(*) FROM votes WHERE votes.spark_id = OLD.spark_id)
      WHERE id = OLD.spark_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_spark_votes_count ON votes;
CREATE TRIGGER trg_update_spark_votes_count
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION recompute_spark_votes_count();
