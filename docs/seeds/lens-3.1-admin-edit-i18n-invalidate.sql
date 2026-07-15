-- =============================================================================
-- LENS-3.1 — let admin_update_event accept title_i18n / description_i18n
-- =============================================================================
-- Why: the admin edit page now sends `title_i18n: null` whenever the title is
-- edited (and likewise for description). The LENS-3 translation packs hold
-- translations of the ORIGINAL scanned text; display prefers the pack over the
-- base column, so a stale pack keeps showing the old wording after an edit.
-- The previous RPC whitelist rejected these keys with invalid_field.
--
-- Body is identical to phase-18 plus the two i18n columns.
-- =============================================================================

create or replace function public.admin_update_event(p_id uuid, patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  allowed_keys text[] := array[
    'title','slug','description','category','date','time','end_time','timezone',
    'price','highlight','status','country','region','location_slug',
    'lat','lng','address','banner_url','gallery_urls','admin_note','event_type','is_civic',
    'featured_movement_slug','organizer_name','organizer_phone','organizer_website',
    'organizer_socials','organizer_contact','telegram_link','whatsapp_link',
    'safety_notes','expected_attendees','is_online','online_url','tags','language',
    'recurrence','recurrence_until','recurrence_days_of_week','recurrence_exceptions',
    'title_i18n','description_i18n'
  ];
  k text;
  gallery_patch text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  for k in select jsonb_object_keys(patch)
  loop
    if not (k = any(allowed_keys)) then
      raise exception 'invalid_field: %', k using errcode = '22023';
    end if;
  end loop;

  if patch ? 'gallery_urls' and jsonb_typeof(patch->'gallery_urls') = 'array' then
    gallery_patch := array(select jsonb_array_elements_text(patch->'gallery_urls'));
  end if;

  update public.events set
    title                  = coalesce(patch->>'title', title),
    title_i18n             = case when patch ? 'title_i18n' then nullif(patch->'title_i18n', 'null'::jsonb) else title_i18n end,
    slug                   = coalesce(patch->>'slug', slug),
    description            = coalesce(patch->>'description', description),
    description_i18n       = case when patch ? 'description_i18n' then nullif(patch->'description_i18n', 'null'::jsonb) else description_i18n end,
    category               = coalesce(patch->>'category', category),
    date                   = coalesce((patch->>'date')::date, date),
    time                   = case when patch ? 'time'     then patch->>'time'     else time end,
    end_time               = case when patch ? 'end_time' then patch->>'end_time' else end_time end,
    timezone               = coalesce(patch->>'timezone', timezone),
    price                  = case when patch ? 'price' then patch->>'price' else price end,
    highlight              = coalesce((patch->>'highlight')::boolean, highlight),
    status                 = coalesce(patch->>'status', status),
    country                = coalesce(patch->>'country', country),
    region                 = coalesce(patch->>'region', region),
    location_slug          = coalesce(patch->>'location_slug', location_slug),
    lat                    = case when patch ? 'lat' then nullif(patch->>'lat','')::double precision else lat end,
    lng                    = case when patch ? 'lng' then nullif(patch->>'lng','')::double precision else lng end,
    address                = case when patch ? 'address' then patch->>'address' else address end,
    banner_url             = coalesce(patch->>'banner_url', banner_url),
    gallery_urls           = coalesce(gallery_patch, gallery_urls),
    admin_note             = case when patch ? 'admin_note' then patch->>'admin_note' else admin_note end,
    event_type             = case when patch ? 'event_type' then patch->>'event_type' else event_type end,
    is_civic               = coalesce((patch->>'is_civic')::boolean, is_civic),
    featured_movement_slug = case when patch ? 'featured_movement_slug' then patch->>'featured_movement_slug' else featured_movement_slug end,
    organizer_name         = case when patch ? 'organizer_name' then patch->>'organizer_name' else organizer_name end,
    organizer_phone        = case when patch ? 'organizer_phone' then patch->>'organizer_phone' else organizer_phone end,
    organizer_website      = case when patch ? 'organizer_website' then patch->>'organizer_website' else organizer_website end,
    organizer_socials      = case when patch ? 'organizer_socials' then nullif(patch->'organizer_socials', 'null'::jsonb) else organizer_socials end,
    organizer_contact      = case when patch ? 'organizer_contact' then patch->>'organizer_contact' else organizer_contact end,
    telegram_link          = case when patch ? 'telegram_link' then patch->>'telegram_link' else telegram_link end,
    whatsapp_link          = case when patch ? 'whatsapp_link' then patch->>'whatsapp_link' else whatsapp_link end,
    safety_notes           = case when patch ? 'safety_notes' then patch->>'safety_notes' else safety_notes end,
    expected_attendees     = case when patch ? 'expected_attendees' then nullif(patch->>'expected_attendees','')::integer else expected_attendees end,
    is_online              = coalesce((patch->>'is_online')::boolean, is_online),
    online_url             = case when patch ? 'online_url' then patch->>'online_url' else online_url end,
    tags                   = case when patch ? 'tags'
                                 then array(select jsonb_array_elements_text(patch->'tags'))
                                 else tags end,
    language               = coalesce(patch->>'language', language),
    recurrence             = case when patch ? 'recurrence' then patch->>'recurrence' else recurrence end,
    recurrence_until       = case when patch ? 'recurrence_until' then nullif(patch->>'recurrence_until','')::date else recurrence_until end,
    recurrence_days_of_week = case when patch ? 'recurrence_days_of_week'
                                    then array(select (v.value::text)::int from jsonb_array_elements(patch->'recurrence_days_of_week') v)
                                    else recurrence_days_of_week end,
    recurrence_exceptions   = case when patch ? 'recurrence_exceptions'
                                    then array(select (v.value::text)::date from jsonb_array_elements(patch->'recurrence_exceptions') v)
                                    else recurrence_exceptions end,
    updated_at             = now()
  where id = p_id;
end;
$func$;

grant execute on function public.admin_update_event(uuid, jsonb) to authenticated;
