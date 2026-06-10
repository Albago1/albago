-- Phase 12 — auto-seed cities when a new location is used by an event.
-- Before: cities table was manually curated. Any event with a location_slug
-- not yet in cities was invisible to /map and /events location filters.
-- After: approving any submission in a new city auto-creates the cities row
-- so the dropdown / map / popular list stay in sync.
--
-- Two changes:
--   1. Allow cities.country_code to be NULL (we don't always have an ISO code
--      when the city is resolved via Nominatim).
--   2. Create upsert_city_from_event(slug, name, country, lat, lng, ...) RPC.
--      SECURITY DEFINER, gated on is_admin() because cities is admin-write.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.cities
  ALTER COLUMN country_code DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_city_from_event(
  p_slug          text,
  p_name          text,
  p_country       text,
  p_lat           double precision,
  p_lng           double precision,
  p_country_code  text DEFAULT NULL,
  p_zoom          double precision DEFAULT 12.5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  city_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'slug_required' USING ERRCODE = '22023';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'coords_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.cities (slug, name, country, country_code, lat, lng, zoom, is_featured)
  VALUES (
    p_slug,
    COALESCE(NULLIF(trim(p_name), ''), p_slug),
    COALESCE(NULLIF(trim(p_country), ''), 'Unknown'),
    p_country_code,
    p_lat,
    p_lng,
    COALESCE(p_zoom, 12.5),
    false
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO city_id;

  IF city_id IS NULL THEN
    SELECT id INTO city_id FROM public.cities WHERE slug = p_slug;
  END IF;

  RETURN city_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(text, text, text, double precision, double precision, text, double precision) TO authenticated;

-- Verify
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'upsert_city_from_event';
