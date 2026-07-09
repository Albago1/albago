-- Phase 30: Poster Studio access.
--
-- studio_access on profiles gates the AI poster creation powers (generate,
-- regenerate, one-tap post-to-social). Admins are entitled implicitly.
-- Granted today by admins from /admin/users; a future payment flow can set
-- the same flag when someone buys a membership.
--
-- Idempotent; safe to re-run.

alter table public.profiles
  add column if not exists studio_access boolean not null default false;

-- ---------------------------------------------------------------------------
-- admin_list_users — re-created with the studio_access column.
-- DROP first: the return-table shape changed.
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
  organizer_verified boolean,
  studio_access boolean
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
      COALESCE(o.verified, false) AS organizer_verified,
      COALESCE(p.studio_access, false) AS studio_access
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.organizers o ON o.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_studio_access — grant or revoke Poster Studio for a user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_studio_access(
  target_user uuid,
  allowed boolean
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

  INSERT INTO public.profiles (id, studio_access)
  VALUES (target_user, allowed)
  ON CONFLICT (id) DO UPDATE SET studio_access = EXCLUDED.studio_access;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(uuid, boolean) TO authenticated;
