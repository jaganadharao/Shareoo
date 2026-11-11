-- Shareo admin dashboard and secure moderation
-- Run this file in Supabase SQL Editor after the original Shareo schema migration.

-- Comments table (the current frontend already reads/writes this table).
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_id uuid NOT NULL REFERENCES public.sparks(id) ON DELETE CASCADE,
  author_name text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_spark_id_created_at_idx
  ON public.comments (spark_id, created_at ASC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Public users may read and add comments, but cannot update or delete them.
DROP POLICY IF EXISTS "public_read_comments" ON public.comments;
CREATE POLICY "public_read_comments" ON public.comments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_comments" ON public.comments;
CREATE POLICY "public_insert_comments" ON public.comments
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(body) BETWEEN 1 AND 500);

-- Remove the original migration's unrestricted write/delete permissions.
DROP POLICY IF EXISTS "anon_delete_sparks" ON public.sparks;
DROP POLICY IF EXISTS "anon_update_sparks" ON public.sparks;
DROP POLICY IF EXISTS "admin_delete_sparks" ON public.sparks;
CREATE POLICY "admin_delete_sparks" ON public.sparks
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Users can still post and read sparks. Direct client updates are not needed.
DROP POLICY IF EXISTS "anon_delete_comments" ON public.comments;
DROP POLICY IF EXISTS "admin_delete_comments" ON public.comments;
CREATE POLICY "admin_delete_comments" ON public.comments
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin-only aggregate counts. auth.users is never exposed to the browser.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'sparks', (SELECT count(*) FROM public.sparks),
    'comments', (SELECT count(*) FROM public.comments)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
