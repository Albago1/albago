-- Phase 11 — admin_update_event RPC.
-- Lets an admin patch any whitelisted column on a published or draft event row
-- from /admin/events/[id]/edit. SECURITY DEFINER (events has no UPDATE RLS
-- policy by design — the is_admin() check inside the function body is the
-- security boundary, matching admin_publish_event / admin_reject_event).
--
-- Patch is a JSONB object. Only keys in the whitelist are accepted. Any other
-- key raises a forbidden_column error so the caller knows their patch was
-- rejected (no silent ignores).
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.admin_update_event(
  event_id uuid,
  patch    jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'title',
    'description',
    'date',
    'time',
    'price',
    'category',
    'highlight',
    'status',
    'location_slug',
    'country',
    'region',
    'lat',
    'lng',
    'banner_url',
    'admin_note',
    'event_type',
    'is_civic',
    'featured_movement_slug',
    'organizer_contact',
    'telegram_link',
    'whatsapp_link',
    'safety_notes',
    'expected_attendees'
  ];
  patch_key text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  FOR patch_key IN SELECT jsonb_object_keys(patch)
  LOOP
    IF NOT (patch_key = ANY(allowed)) THEN
      RAISE EXCEPTION 'forbidden_column: %', patch_key USING ERRCODE = '42501';
    END IF;
  END LOOP;

  UPDATE public.events SET
    title                  = COALESCE(patch->>'title', title),
    description            = COALESCE(patch->>'description', description),
    date                   = COALESCE((patch->>'date')::date, date),
    time                   = COALESCE(patch->>'time', time),
    price                  = COALESCE(patch->>'price', price),
    category               = COALESCE(patch->>'category', category),
    highlight              = COALESCE((patch->>'highlight')::boolean, highlight),
    status                 = COALESCE(patch->>'status', status),
    location_slug          = COALESCE(patch->>'location_slug', location_slug),
    country                = COALESCE(patch->>'country', country),
    region                 = COALESCE(patch->>'region', region),
    lat                    = COALESCE((patch->>'lat')::double precision, lat),
    lng                    = COALESCE((patch->>'lng')::double precision, lng),
    banner_url             = COALESCE(patch->>'banner_url', banner_url),
    admin_note             = COALESCE(patch->>'admin_note', admin_note),
    event_type             = COALESCE(patch->>'event_type', event_type),
    is_civic               = COALESCE((patch->>'is_civic')::boolean, is_civic),
    featured_movement_slug = COALESCE(patch->>'featured_movement_slug', featured_movement_slug),
    organizer_contact      = COALESCE(patch->>'organizer_contact', organizer_contact),
    telegram_link          = COALESCE(patch->>'telegram_link', telegram_link),
    whatsapp_link          = COALESCE(patch->>'whatsapp_link', whatsapp_link),
    safety_notes           = COALESCE(patch->>'safety_notes', safety_notes),
    expected_attendees     = COALESCE((patch->>'expected_attendees')::integer, expected_attendees),
    updated_at             = now()
  WHERE id = event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated;

-- Verify
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'admin_update_event';
