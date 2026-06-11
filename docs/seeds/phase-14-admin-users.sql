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
-- admin_list_users — paginated user roster with auth + profile metadata.
-- ---------------------------------------------------------------------------
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

  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at       = COALESCE(confirmed_at, now())
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
