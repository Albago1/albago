-- Phase 14 — admin users management RPCs.
-- Lets admins list all platform users, manually confirm pre-existing accounts'
-- email addresses (useful for accounts grandfathered in before email
-- confirmation was enabled), and toggle the admin role on profiles.
--
-- All three RPCs are SECURITY DEFINER + gated on is_admin() since auth.users
-- is owned by supabase_auth_admin and isn't reachable from the anon role.
--
-- Idempotent; safe to re-run.

-- ---------------------------------------------------------------------------
-- admin_list_users — paginated user roster with auth + profile metadata
-- plus organizer state (is_organizer / organizer_verified).
--
-- DROP first because the return-table shape evolved (added two columns)
-- and Postgres rejects CREATE OR REPLACE on a function signature change.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  is_organizer boolean,
  organizer_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      u.created_at,
      u.email_confirmed_at,
      u.last_sign_in_at,
      COALESCE(p.role, 'user')::text AS role,
      (o.id IS NOT NULL) AS is_organizer,
      COALESCE(o.verified, false) AS organizer_verified
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.organizers o ON o.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_confirm_user_email — manually mark a user's email as confirmed.
-- Useful for accounts created before email confirmation was enabled OR for
-- helping a user who lost their confirmation link.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  -- confirmed_at is a GENERATED column (derived from email/phone confirmation)
  -- on current Supabase — writing it fails with 'column "confirmed_at" can
  -- only be updated to DEFAULT'. Setting email_confirmed_at is sufficient.
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = target_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_user_role — promote/demote a user. Upserts into profiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, role)
  VALUES (target_user, new_role)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_delete_user — hard-delete a user from auth.users. Cascades to
-- profiles / saved_events / event_submissions / organizers / volunteer_signups
-- via existing FKs. Events the user authored stay published with a NULL
-- organizer_id (FK is SET NULL) unless `also_delete_events = true`.
--
-- Self-deletion is blocked.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user uuid,
  also_delete_events boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_delete_self' USING ERRCODE = '22023';
  END IF;

  IF also_delete_events THEN
    DELETE FROM public.events WHERE organizer_id = target_user;
  END IF;

  DELETE FROM auth.users WHERE id = target_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_grant_organizer — promote a regular user to an organizer.
-- Inserts a minimal organizers row using the user's email as contact_email
-- and a slug derived from display_name + 6 chars of their UUID.
-- Errors with already_organizer if a row already exists.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_organizer(
  target_user uuid,
  display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  base_slug text;
  final_slug text;
  clean_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  clean_name := trim(display_name);
  IF clean_name = '' THEN
    RAISE EXCEPTION 'display_name_required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizers WHERE id = target_user) THEN
    RAISE EXCEPTION 'already_organizer' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = target_user;
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = '02000';
  END IF;

  base_slug := regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'organizer';
  END IF;
  final_slug := substring(base_slug FROM 1 FOR 40) || '-' ||
                substring(replace(target_user::text, '-', '') FROM 1 FOR 6);

  INSERT INTO public.organizers (id, display_name, slug, contact_email, verified)
  VALUES (target_user, clean_name, final_slug, user_email, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_organizer(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_revoke_organizer — strip organizer status from a user. Events they
-- authored stay published with organizer_id SET NULL via the existing FK.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_organizer(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organizers WHERE id = target_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_organizer(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_organizer_verified — toggle the green Verified badge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_organizer_verified(
  target_user uuid,
  verified_value boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizers
  SET verified = verified_value
  WHERE id = target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_an_organizer' USING ERRCODE = '02000';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_organizer_verified(uuid, boolean) TO authenticated;
