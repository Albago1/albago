-- =====================================================================
-- BASELINE of production schema `public` (project stvjpcqcpmhngihfjhga)
-- RECONSTRUCTED from the live system catalog on 2026-10-04 via read-only
-- queries (pg_get_constraintdef / indexdef / functiondef / triggerdef).
-- NOT produced by pg_dump. Describes what ALREADY EXISTS in production:
-- it must be marked as applied (supabase migration repair --status applied)
-- and must NEVER be executed against the production database.
-- Source catalog: supabase/baseline/catalog/*.json
-- =====================================================================

SET check_function_bodies = false;

-- ---------- TABLES ----------
CREATE TABLE public.ai_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  surface text NOT NULL,
  user_id uuid,
  model text,
  input_tokens integer DEFAULT 0 NOT NULL,
  output_tokens integer DEFAULT 0 NOT NULL,
  total_tokens integer DEFAULT 0 NOT NULL,
  tools text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE TABLE public.cities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  country_code text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  timezone text,
  zoom double precision DEFAULT 12.5 NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crawl_sources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  url text NOT NULL,
  normalized_url text NOT NULL,
  label text,
  kind text,
  enabled boolean DEFAULT true NOT NULL,
  last_run_at timestamp with time zone,
  last_found_count integer,
  last_status text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_import_candidates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_url text NOT NULL,
  normalized_url text NOT NULL,
  source_name text,
  image_url text,
  parser_version text,
  status text DEFAULT 'needs_review'::text NOT NULL,
  error text,
  confidence text,
  warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
  missing_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
  reading jsonb,
  resolution jsonb,
  title text,
  event_date text,
  venue_name text,
  city_label text,
  country text,
  duplicate_status text,
  duplicate_event_slug text,
  submission_id uuid,
  admin_note text,
  imported_by uuid,
  decided_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_series (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  kind text DEFAULT 'other'::text NOT NULL,
  title text NOT NULL,
  subtitle text,
  summary text,
  description text,
  category text DEFAULT 'culture'::text NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  poster_url text,
  banner_url text,
  gallery_urls text[] DEFAULT '{}'::text[] NOT NULL,
  trailer_url text,
  credits jsonb DEFAULT '{}'::jsonb NOT NULL,
  official_url text,
  organizer_id uuid,
  is_civic boolean DEFAULT false NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  phase_override text,
  title_i18n jsonb,
  summary_i18n jsonb,
  description_i18n jsonb,
  search_vector tsvector,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.event_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  venue_name text NOT NULL,
  place_id uuid,
  category text NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  price text,
  contact_email text,
  submitted_by_user_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  admin_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  country text DEFAULT 'Albania'::text NOT NULL,
  region text,
  location_slug text DEFAULT 'tirana'::text NOT NULL,
  event_type text,
  is_civic boolean DEFAULT false NOT NULL,
  featured_movement_slug text,
  organizer_contact text,
  telegram_link text,
  whatsapp_link text,
  safety_notes text,
  expected_attendees integer,
  lat double precision,
  lng double precision,
  end_time text,
  timezone text DEFAULT 'Europe/Tirane'::text,
  tags text[] DEFAULT '{}'::text[],
  language text DEFAULT 'en'::text,
  address text,
  is_online boolean DEFAULT false NOT NULL,
  online_url text,
  organizer_name text,
  organizer_phone text,
  organizer_website text,
  organizer_socials jsonb,
  banner_url text,
  recurrence text DEFAULT 'none'::text NOT NULL,
  recurrence_until date,
  recurrence_days_of_week integer[] DEFAULT '{}'::integer[],
  recurrence_exceptions date[] DEFAULT '{}'::date[],
  gallery_urls text[] DEFAULT '{}'::text[] NOT NULL,
  address_hint text,
  title_i18n jsonb,
  description_i18n jsonb,
  end_date date,
  cover_in_gallery boolean DEFAULT true NOT NULL,
  content_sections jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  place_id uuid,
  category text NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  price text,
  highlight boolean DEFAULT false,
  status text DEFAULT 'published'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  country text DEFAULT 'Albania'::text NOT NULL,
  region text,
  location_slug text DEFAULT 'tirana'::text NOT NULL,
  search_vector tsvector,
  organizer_id uuid,
  origin text DEFAULT 'admin_seeded'::text NOT NULL,
  banner_url text,
  published_at timestamp with time zone,
  admin_note text,
  event_type text,
  is_civic boolean DEFAULT false NOT NULL,
  featured_movement_slug text,
  organizer_contact text,
  telegram_link text,
  whatsapp_link text,
  safety_notes text,
  expected_attendees integer,
  lat double precision,
  lng double precision,
  end_time text,
  timezone text DEFAULT 'Europe/Tirane'::text,
  tags text[] DEFAULT '{}'::text[],
  language text DEFAULT 'en'::text,
  address text,
  is_online boolean DEFAULT false NOT NULL,
  online_url text,
  organizer_name text,
  organizer_phone text,
  organizer_website text,
  organizer_socials jsonb,
  recurrence text DEFAULT 'none'::text NOT NULL,
  recurrence_until date,
  recurrence_days_of_week integer[] DEFAULT '{}'::integer[],
  recurrence_exceptions date[] DEFAULT '{}'::date[],
  gallery_urls text[] DEFAULT '{}'::text[] NOT NULL,
  address_hint text,
  title_i18n jsonb,
  description_i18n jsonb,
  ticket_url text,
  ticket_provider text,
  price_from_cents integer,
  price_currency character(3) DEFAULT 'EUR'::bpchar NOT NULL,
  ticket_sales_status text,
  door_tickets boolean DEFAULT false NOT NULL,
  age_restriction text,
  official_source_url text,
  last_verified_at timestamp with time zone,
  listing_status text,
  doors_time text,
  practical_info jsonb,
  end_date date,
  cover_in_gallery boolean DEFAULT true NOT NULL,
  content_sections jsonb DEFAULT '[]'::jsonb NOT NULL,
  submitted_by_user_id uuid,
  series_id uuid,
  series_label text,
  showtimes jsonb,
  threshold_min integer,
  threshold_deadline date
);

CREATE TABLE public.interactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  city text,
  country text,
  platform text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  path text,
  referrer text,
  session_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price_cents integer DEFAULT 0 NOT NULL,
  unit_fee_cents integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  event_id uuid NOT NULL,
  organizer_id uuid,
  status text NOT NULL,
  provider text NOT NULL,
  provider_session_id text,
  provider_payment_intent text,
  subtotal_cents integer DEFAULT 0 NOT NULL,
  fee_cents integer DEFAULT 0 NOT NULL,
  payment_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  currency character(3) DEFAULT 'EUR'::bpchar NOT NULL,
  contact_email text,
  idempotency_key text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone
);

CREATE TABLE public.organizer_event_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  organizer_id uuid NOT NULL,
  reporter_user_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  resolution text
);

CREATE TABLE public.organizer_onboarding_responses (
  organizer_id uuid NOT NULL,
  event_types text[] DEFAULT '{}'::text[] NOT NULL,
  attendee_age_ranges text[] DEFAULT '{}'::text[] NOT NULL,
  expected_attendance_size text,
  expected_yearly_revenue text,
  events_per_year text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.organizers (
  id uuid NOT NULL,
  display_name text NOT NULL,
  slug text NOT NULL,
  bio text,
  contact_email text NOT NULL,
  website_url text,
  verified boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  verification_tier text DEFAULT 'unverified'::text NOT NULL,
  verification_tier_at timestamp with time zone DEFAULT now(),
  phone text,
  id_document_url text,
  id_review_status text DEFAULT 'none'::text NOT NULL,
  id_review_notes text,
  id_reviewed_at timestamp with time zone,
  id_reviewed_by uuid,
  weekly_event_quota integer DEFAULT 10 NOT NULL
);

CREATE TABLE public.places (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  city text DEFAULT 'Tirana'::text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  image_url text,
  options text[] DEFAULT '{}'::text[],
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  country text DEFAULT 'Albania'::text NOT NULL,
  region text,
  location_slug text DEFAULT 'tirana'::text NOT NULL,
  google_place_id text,
  website_url text,
  phone text,
  status text DEFAULT 'active'::text NOT NULL,
  cover_image_url text,
  images text[],
  search_vector tsvector
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  role text DEFAULT 'user'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  notification_preferences jsonb DEFAULT jsonb_build_object('saved_event_updates', true) NOT NULL,
  display_name text,
  studio_access boolean DEFAULT false NOT NULL,
  avatar_url text
);

CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  kind text DEFAULT 'webpush'::text NOT NULL,
  endpoint text NOT NULL,
  p256dh text,
  auth text,
  locale text,
  city_slug text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.saved_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  saved_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.series_demand (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  series_id uuid NOT NULL,
  city_slug text NOT NULL,
  city_label text,
  country text,
  user_id uuid,
  email text,
  note text,
  source text DEFAULT 'web'::text NOT NULL,
  notified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  identity_key text GENERATED ALWAYS AS (COALESCE((user_id)::text, lower(email))) STORED
);

CREATE TABLE public.social_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  platform text NOT NULL,
  label text NOT NULL,
  handle text,
  credentials text,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'connected'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.social_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.social_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid,
  account_id uuid NOT NULL,
  kind text NOT NULL,
  caption text DEFAULT ''::text NOT NULL,
  asset_urls text[] DEFAULT '{}'::text[] NOT NULL,
  scheduled_at timestamp with time zone,
  status text DEFAULT 'draft'::text NOT NULL,
  external_id text,
  external_url text,
  error text,
  attempts integer DEFAULT 0 NOT NULL,
  campaign_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  published_at timestamp with time zone
);

CREATE TABLE public.ticket_scans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid,
  event_id uuid NOT NULL,
  scanned_by uuid,
  result text NOT NULL,
  raw text,
  device_note text,
  scanned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ticket_tiers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price_cents integer DEFAULT 0 NOT NULL,
  currency character(3) DEFAULT 'EUR'::bpchar NOT NULL,
  capacity integer NOT NULL,
  max_per_order integer DEFAULT 6 NOT NULL,
  sales_start timestamp with time zone,
  sales_end timestamp with time zone,
  visibility text DEFAULT 'public'::text NOT NULL,
  fee_mode text DEFAULT 'pass'::text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_item_id uuid NOT NULL,
  event_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  owner_user_id uuid,
  serial text NOT NULL,
  attendee_name text,
  status text DEFAULT 'valid'::text NOT NULL,
  qr_version integer DEFAULT 1 NOT NULL,
  payment_due_at_door boolean DEFAULT false NOT NULL,
  checked_in_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.volunteer_signups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text NOT NULL,
  country text,
  roles text[] NOT NULL,
  availability_note text,
  movement_slug text,
  status text DEFAULT 'new'::text NOT NULL
);

-- ---------- CONSTRAINTS (PK/UNIQUE/CHECK, then FOREIGN KEYS) ----------
ALTER TABLE ONLY public.ai_usage ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cities ADD CONSTRAINT cities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.crawl_sources ADD CONSTRAINT crawl_sources_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_submissions ADD CONSTRAINT event_submissions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizer_onboarding_responses ADD CONSTRAINT organizer_onboarding_responses_pkey PRIMARY KEY (organizer_id);
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.places ADD CONSTRAINT places_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.series_demand ADD CONSTRAINT series_demand_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.social_accounts ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.social_campaigns ADD CONSTRAINT social_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ticket_scans ADD CONSTRAINT ticket_scans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.volunteer_signups ADD CONSTRAINT volunteer_signups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cities ADD CONSTRAINT cities_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_event_id_reporter_user_id_key UNIQUE (event_id, reporter_user_id);
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.places ADD CONSTRAINT places_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_user_id_event_id_key UNIQUE (user_id, event_id);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_serial_key UNIQUE (serial);
ALTER TABLE ONLY public.crawl_sources ADD CONSTRAINT crawl_sources_kind_check CHECK ((kind = ANY (ARRAY['venue'::text, 'promoter'::text, 'ticketing'::text, 'listing'::text, 'event'::text])));
ALTER TABLE ONLY public.crawl_sources ADD CONSTRAINT crawl_sources_last_status_check CHECK ((last_status = ANY (ARRAY['ok'::text, 'error'::text, 'empty'::text])));
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_duplicate_status_check CHECK ((duplicate_status = ANY (ARRAY['live'::text, 'in_review'::text, 'none'::text])));
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'needs_review'::text, 'approved'::text, 'rejected'::text, 'failed'::text])));
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_kind_check CHECK ((kind = ANY (ARRAY['film_run'::text, 'tour'::text, 'exhibition'::text, 'course'::text, 'conference'::text, 'campaign'::text, 'residency'::text, 'other'::text])));
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_phase_override_check CHECK (((phase_override IS NULL) OR (phase_override = ANY (ARRAY['announced'::text, 'confirming'::text, 'scheduled'::text, 'running'::text, 'ended'::text]))));
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
ALTER TABLE ONLY public.event_submissions ADD CONSTRAINT event_submissions_event_type_check CHECK (((event_type IS NULL) OR (event_type = ANY (ARRAY['protest'::text, 'civic_gathering'::text, 'movement_event'::text, 'demonstration'::text]))));
ALTER TABLE ONLY public.event_submissions ADD CONSTRAINT event_submissions_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text])));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_civic_no_tickets CHECK ((NOT (COALESCE(is_civic, false) AND ((ticket_url IS NOT NULL) OR (price_from_cents > 0)))));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_end_date_after_start CHECK (((end_date IS NULL) OR (end_date >= date)));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_event_type_check CHECK (((event_type IS NULL) OR (event_type = ANY (ARRAY['protest'::text, 'civic_gathering'::text, 'movement_event'::text, 'demonstration'::text]))));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_listing_status_check CHECK (((listing_status IS NULL) OR (listing_status = ANY (ARRAY['confirmed'::text, 'updated'::text, 'postponed'::text, 'cancelled'::text, 'provisional'::text]))));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_origin_check CHECK ((origin = ANY (ARRAY['admin_seeded'::text, 'organizer_dashboard'::text, 'community_submission'::text, 'imported'::text])));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_price_from_cents_check CHECK ((price_from_cents >= 0));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text])));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'rejected'::text, 'cancelled'::text, 'postponed'::text, 'completed'::text])));
ALTER TABLE ONLY public.events ADD CONSTRAINT events_ticket_sales_status_check CHECK ((ticket_sales_status = ANY (ARRAY['on_sale'::text, 'sold_out'::text])));
ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_entity_type_check CHECK ((entity_type = ANY (ARRAY['event'::text, 'place'::text, 'placard'::text, 'submission'::text])));
ALTER TABLE ONLY public.interactions ADD CONSTRAINT interactions_type_check CHECK ((type = ANY (ARRAY['event_view'::text, 'protest_view'::text, 'place_view'::text, 'placard_view'::text, 'placard_download'::text, 'share_click'::text, 'city_search'::text, 'search_query'::text, 'submit_started'::text, 'submit_completed'::text, 'calendar_add'::text, 'subscribe'::text, 'outbound_click'::text])));
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_quantity_check CHECK ((quantity > 0));
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_provider_check CHECK ((provider = ANY (ARRAY['free'::text, 'stripe'::text, 'cash_at_door'::text])));
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'awaiting_door'::text, 'paid'::text, 'cancelled'::text, 'expired'::text, 'refunded'::text, 'partially_refunded'::text])));
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'misleading'::text, 'inappropriate'::text, 'duplicate'::text, 'other'::text])));
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_resolution_check CHECK ((resolution = ANY (ARRAY['dismissed'::text, 'event_unpublished'::text, 'organizer_unverified'::text])));
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_id_review_status_check CHECK ((id_review_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_verification_tier_check CHECK ((verification_tier = ANY (ARRAY['unverified'::text, 'established'::text, 'verified'::text])));
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_kind_check CHECK ((kind = ANY (ARRAY['webpush'::text, 'fcm'::text, 'apns'::text])));
ALTER TABLE ONLY public.series_demand ADD CONSTRAINT series_demand_has_identity CHECK (((user_id IS NOT NULL) OR (email IS NOT NULL)));
ALTER TABLE ONLY public.series_demand ADD CONSTRAINT series_demand_source_check CHECK ((source = ANY (ARRAY['web'::text, 'share'::text, 'qr'::text, 'admin'::text])));
ALTER TABLE ONLY public.social_accounts ADD CONSTRAINT social_accounts_platform_check CHECK ((platform = ANY (ARRAY['telegram'::text, 'instagram'::text, 'facebook'::text, 'x'::text, 'tiktok'::text])));
ALTER TABLE ONLY public.social_accounts ADD CONSTRAINT social_accounts_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'expiring'::text, 'error'::text, 'disabled'::text])));
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'carousel'::text, 'story'::text, 'reel'::text, 'link'::text, 'text'::text])));
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'queued'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.ticket_scans ADD CONSTRAINT ticket_scans_result_check CHECK ((result = ANY (ARRAY['ok'::text, 'duplicate'::text, 'void'::text, 'refunded'::text, 'wrong_event'::text, 'bad_signature'::text, 'not_found'::text])));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_capacity_check CHECK ((capacity > 0));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_fee_mode_check CHECK ((fee_mode = ANY (ARRAY['absorb'::text, 'pass'::text])));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_max_per_order_check CHECK ((max_per_order > 0));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_price_cents_check CHECK ((price_cents >= 0));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'sold_out_manual'::text, 'archived'::text])));
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'hidden'::text, 'unlock_code'::text])));
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_status_check CHECK ((status = ANY (ARRAY['valid'::text, 'checked_in'::text, 'void'::text, 'refunded'::text])));
ALTER TABLE ONLY public.volunteer_signups ADD CONSTRAINT volunteer_signups_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'confirmed'::text, 'declined'::text])));
ALTER TABLE ONLY public.ai_usage ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.crawl_sources ADD CONSTRAINT crawl_sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_import_candidates ADD CONSTRAINT event_import_candidates_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_series ADD CONSTRAINT event_series_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.event_submissions ADD CONSTRAINT event_submissions_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_place_id_fkey FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_series_id_fkey FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.events ADD CONSTRAINT events_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_event_reports ADD CONSTRAINT organizer_event_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizer_onboarding_responses ADD CONSTRAINT organizer_onboarding_responses_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizers ADD CONSTRAINT organizers_id_reviewed_by_fkey FOREIGN KEY (id_reviewed_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.saved_events ADD CONSTRAINT saved_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.series_demand ADD CONSTRAINT series_demand_series_id_fkey FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.series_demand ADD CONSTRAINT series_demand_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.social_campaigns ADD CONSTRAINT social_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_account_id_fkey FOREIGN KEY (account_id) REFERENCES social_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES social_campaigns(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.social_posts ADD CONSTRAINT social_posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ticket_scans ADD CONSTRAINT ticket_scans_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ticket_scans ADD CONSTRAINT ticket_scans_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ticket_scans ADD CONSTRAINT ticket_scans_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ticket_tiers ADD CONSTRAINT ticket_tiers_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) DEFERRABLE INITIALLY DEFERRED;

-- ---------- INDEXES (excluding constraint-backed) ----------
CREATE INDEX ai_usage_created_at_idx ON public.ai_usage USING btree (created_at DESC);
CREATE INDEX ai_usage_surface_created_at_idx ON public.ai_usage USING btree (surface, created_at DESC);
CREATE INDEX crawl_sources_enabled_idx ON public.crawl_sources USING btree (enabled, created_at DESC);
CREATE UNIQUE INDEX crawl_sources_normalized_url_key ON public.crawl_sources USING btree (normalized_url);
CREATE UNIQUE INDEX event_import_candidates_normalized_url_key ON public.event_import_candidates USING btree (normalized_url);
CREATE INDEX event_import_candidates_status_idx ON public.event_import_candidates USING btree (status, created_at DESC);
CREATE INDEX event_series_kind_idx ON public.event_series USING btree (kind);
CREATE INDEX event_series_organizer_idx ON public.event_series USING btree (organizer_id) WHERE (organizer_id IS NOT NULL);
CREATE INDEX event_series_search_idx ON public.event_series USING gin (search_vector);
CREATE INDEX event_series_status_idx ON public.event_series USING btree (status);
CREATE INDEX event_submissions_is_civic_idx ON public.event_submissions USING btree (is_civic, created_at DESC) WHERE (is_civic = true);
CREATE INDEX events_featured_movement_idx ON public.events USING btree (featured_movement_slug, date) WHERE (featured_movement_slug IS NOT NULL);
CREATE INDEX events_is_civic_date_idx ON public.events USING btree (is_civic, date) WHERE (is_civic = true);
CREATE INDEX events_is_online_idx ON public.events USING btree (is_online) WHERE (is_online = true);
CREATE INDEX events_organizer_id_status_idx ON public.events USING btree (organizer_id, status) WHERE (organizer_id IS NOT NULL);
CREATE INDEX events_recurrence_dow_gin ON public.events USING gin (recurrence_days_of_week);
CREATE INDEX events_search_vector_idx ON public.events USING gin (search_vector);
CREATE INDEX events_series_id_date_idx ON public.events USING btree (series_id, date) WHERE (series_id IS NOT NULL);
CREATE INDEX events_status_created_at_idx ON public.events USING btree (status, created_at DESC) WHERE (status = 'pending_review'::text);
CREATE INDEX events_submitted_by_user_id_idx ON public.events USING btree (submitted_by_user_id) WHERE (submitted_by_user_id IS NOT NULL);
CREATE INDEX events_tags_gin ON public.events USING gin (tags);
CREATE INDEX interactions_entity_idx ON public.interactions USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX interactions_session_idx ON public.interactions USING btree (session_id, created_at DESC);
CREATE INDEX interactions_type_created_idx ON public.interactions USING btree (type, created_at DESC);
CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_items_tier_idx ON public.order_items USING btree (tier_id);
CREATE INDEX orders_event_idx ON public.orders USING btree (event_id);
CREATE INDEX orders_pending_idx ON public.orders USING btree (event_id) WHERE (status = 'pending'::text);
CREATE INDEX orders_user_idx ON public.orders USING btree (user_id);
CREATE INDEX organizer_event_reports_org_recent_idx ON public.organizer_event_reports USING btree (organizer_id, created_at DESC);
CREATE UNIQUE INDEX places_google_place_id_unique ON public.places USING btree (google_place_id) WHERE (google_place_id IS NOT NULL);
CREATE INDEX places_search_vector_idx ON public.places USING gin (search_vector);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX saved_events_user_id_idx ON public.saved_events USING btree (user_id);
CREATE INDEX series_demand_created_idx ON public.series_demand USING btree (created_at DESC);
CREATE UNIQUE INDEX series_demand_identity_uidx ON public.series_demand USING btree (series_id, city_slug, identity_key);
CREATE INDEX series_demand_pending_notify_idx ON public.series_demand USING btree (series_id, city_slug) WHERE (notified_at IS NULL);
CREATE INDEX series_demand_series_city_idx ON public.series_demand USING btree (series_id, city_slug);
CREATE INDEX social_posts_due_idx ON public.social_posts USING btree (status, scheduled_at);
CREATE INDEX ticket_scans_event_idx ON public.ticket_scans USING btree (event_id, scanned_at DESC);
CREATE INDEX ticket_tiers_event_idx ON public.ticket_tiers USING btree (event_id);
CREATE INDEX tickets_event_idx ON public.tickets USING btree (event_id);
CREATE INDEX tickets_owner_idx ON public.tickets USING btree (owner_user_id);
CREATE INDEX tickets_tier_counted_idx ON public.tickets USING btree (tier_id) WHERE (status = ANY (ARRAY['valid'::text, 'checked_in'::text]));
CREATE INDEX volunteer_signups_created_idx ON public.volunteer_signups USING btree (created_at DESC);
CREATE INDEX volunteer_signups_movement_idx ON public.volunteer_signups USING btree (movement_slug) WHERE (movement_slug IS NOT NULL);
CREATE INDEX volunteer_signups_status_idx ON public.volunteer_signups USING btree (status);

-- ---------- FUNCTIONS ----------
CREATE OR REPLACE FUNCTION public._normalize_media_sections(p_sections jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(
    jsonb_agg(section order by ord)
      filter (
        where length(section->>'title') > 0
           or length(section->>'body') > 0
           or jsonb_array_length(section->'urls') > 0
      ),
    '[]'::jsonb
  )
  from (
    select
      ord,
      jsonb_build_object(
        'title', left(coalesce(trim(elem->>'title'), ''), 120),
        'body',  left(coalesce(trim(elem->>'body'), ''), 2000),
        'urls',  coalesce((
          select jsonb_agg(u)
          from jsonb_array_elements_text(
            case when jsonb_typeof(elem->'urls') = 'array'
                 then elem->'urls' else '[]'::jsonb end
          ) u
          where length(u) > 0
        ), '[]'::jsonb)
      ) as section
    from jsonb_array_elements(
      case when jsonb_typeof(p_sections) = 'array' then p_sections else '[]'::jsonb end
    ) with ordinality as t(elem, ord)
  ) normalized;
$function$;

CREATE OR REPLACE FUNCTION public._sync_event_banner_from_gallery()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.gallery_urls is not null and coalesce(array_length(new.gallery_urls, 1), 0) > 0 then
    new.banner_url := new.gallery_urls[1];
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._sync_organizer_verified_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.verified := (new.verification_tier = 'verified');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = target_user;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, email_confirmed_at timestamp with time zone, last_sign_in_at timestamp with time zone, role text, is_organizer boolean, organizer_verified boolean, studio_access boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.created_at, u.email_confirmed_at,
      u.last_sign_in_at, COALESCE(p.role, 'user')::text,
      (o.id IS NOT NULL), COALESCE(o.verified, false),
      COALESCE(p.studio_access, false)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.organizers o ON o.id = u.id
    ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_publish_event(event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  DECLARE
    v_status text;
  BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
    SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    IF v_status <> 'pending_review' THEN
      RAISE EXCEPTION 'invalid_transition: cannot publish from %', v_status;
    END IF;
    UPDATE events SET status = 'published', published_at = now(), updated_at = now() WHERE id =
  event_id;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_event(event_id uuid, note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  DECLARE
    v_status text;
  BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
    SELECT status INTO v_status FROM events WHERE id = event_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
    IF v_status <> 'pending_review' THEN
      RAISE EXCEPTION 'invalid_transition: cannot reject from %', v_status;
    END IF;
    UPDATE events SET status = 'rejected', admin_note = note, updated_at = now() WHERE id = event_id;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text DEFAULT NULL::text, new_end_time text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  src        public.events%ROWTYPE;
  new_id     uuid := gen_random_uuid();
  base_slug  text;
  candidate  text;
  suffix     int := 1;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO src FROM public.events WHERE id = source_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  base_slug := regexp_replace(src.slug, '-\d{4}-\d{2}-\d{2}(-\d+)?$', '');
  base_slug := regexp_replace(base_slug, '-\d+$', '');
  candidate := base_slug || '-' || to_char(new_date, 'YYYY-MM-DD');

  WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || to_char(new_date, 'YYYY-MM-DD') || '-' || suffix;
  END LOOP;

  INSERT INTO public.events (
    id, slug, title, description, category,
    date, time, end_time, timezone, price, highlight, status,
    location_slug, country, region, place_id, lat, lng, address,
    is_online, online_url, tags, language, banner_url, gallery_urls,
    organizer_id, origin, organizer_name, organizer_contact, organizer_phone,
    organizer_website, organizer_socials, is_civic, event_type,
    featured_movement_slug, telegram_link, whatsapp_link, safety_notes,
    expected_attendees, recurrence, recurrence_until, recurrence_days_of_week,
    recurrence_exceptions, admin_note, created_at, updated_at
  ) VALUES (
    new_id, candidate, src.title, src.description, src.category,
    new_date, new_time::time, new_end_time::time, src.timezone, src.price, false, 'draft',
    src.location_slug, src.country, src.region, src.place_id, src.lat, src.lng, src.address,
    src.is_online, src.online_url, src.tags, src.language, src.banner_url, src.gallery_urls,
    src.organizer_id, 'organizer_dashboard', src.organizer_name, src.organizer_contact, src.organizer_phone,
    src.organizer_website, src.organizer_socials, src.is_civic, src.event_type,
    src.featured_movement_slug, src.telegram_link, src.whatsapp_link, src.safety_notes,
    src.expected_attendees, src.recurrence, src.recurrence_until, src.recurrence_days_of_week,
    src.recurrence_exceptions,
    'Reposted from ' || src.slug || ' by admin on ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
    now(), now()
  );

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles (id, studio_access)
  VALUES (target_user, allowed)
  ON CONFLICT (id) DO UPDATE SET studio_access = EXCLUDED.studio_access;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_event(event_id uuid, patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[] := ARRAY[
    'title','description','date','end_date','time','end_time','timezone','price',
    'category','highlight','status','location_slug','country','region',
    'lat','lng','address','banner_url','admin_note','event_type','is_civic',
    'featured_movement_slug','organizer_contact','organizer_name',
    'organizer_phone','organizer_website','organizer_socials',
    'telegram_link','whatsapp_link','safety_notes','expected_attendees',
    'is_online','online_url','tags','language',
    'recurrence','recurrence_until','recurrence_days_of_week',
    'recurrence_exceptions',
    'title_i18n','description_i18n'
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
    title_i18n             = CASE WHEN patch ? 'title_i18n'
                                  THEN NULLIF(patch->'title_i18n', 'null'::jsonb)
                                  ELSE title_i18n END,
    description            = COALESCE(patch->>'description', description),
    description_i18n       = CASE WHEN patch ? 'description_i18n'
                                  THEN NULLIF(patch->'description_i18n', 'null'::jsonb)
                                  ELSE description_i18n END,
    date                   = COALESCE((patch->>'date')::date, date),
    end_date               = CASE WHEN patch ? 'end_date'
                                  THEN NULLIF(patch->>'end_date', '')::date
                                  ELSE end_date END,
    time                   = COALESCE(NULLIF(patch->>'time', '')::time without time zone, time),
    end_time               = COALESCE(patch->>'end_time', end_time),
    timezone               = COALESCE(patch->>'timezone', timezone),
    price                  = COALESCE(patch->>'price', price),
    category               = COALESCE(patch->>'category', category),
    highlight              = COALESCE((patch->>'highlight')::boolean, highlight),
    status                 = COALESCE(patch->>'status', status),
    location_slug          = COALESCE(patch->>'location_slug', location_slug),
    country                = COALESCE(patch->>'country', country),
    region                 = COALESCE(patch->>'region', region),
    lat                    = COALESCE((patch->>'lat')::double precision, lat),
    lng                    = COALESCE((patch->>'lng')::double precision, lng),
    address                = COALESCE(patch->>'address', address),
    banner_url             = COALESCE(patch->>'banner_url', banner_url),
    admin_note             = COALESCE(patch->>'admin_note', admin_note),
    event_type             = COALESCE(patch->>'event_type', event_type),
    is_civic               = COALESCE((patch->>'is_civic')::boolean, is_civic),
    featured_movement_slug = COALESCE(patch->>'featured_movement_slug', featured_movement_slug),
    organizer_contact      = COALESCE(patch->>'organizer_contact', organizer_contact),
    organizer_name         = COALESCE(patch->>'organizer_name', organizer_name),
    organizer_phone        = COALESCE(patch->>'organizer_phone', organizer_phone),
    organizer_website      = COALESCE(patch->>'organizer_website', organizer_website),
    organizer_socials      = CASE WHEN patch ? 'organizer_socials'
                                  THEN NULLIF(patch->'organizer_socials', 'null'::jsonb)
                                  ELSE organizer_socials END,
    telegram_link          = COALESCE(patch->>'telegram_link', telegram_link),
    whatsapp_link          = COALESCE(patch->>'whatsapp_link', whatsapp_link),
    safety_notes           = COALESCE(patch->>'safety_notes', safety_notes),
    expected_attendees     = COALESCE(NULLIF(patch->>'expected_attendees', '')::integer, expected_attendees),
    is_online              = COALESCE((patch->>'is_online')::boolean, is_online),
    online_url             = COALESCE(patch->>'online_url', online_url),
    tags                   = CASE WHEN patch ? 'tags'
                                  THEN ARRAY(SELECT jsonb_array_elements_text(patch->'tags'))
                                  ELSE tags END,
    language               = COALESCE(patch->>'language', language),
    recurrence             = COALESCE(patch->>'recurrence', recurrence),
    recurrence_until       = CASE WHEN patch ? 'recurrence_until'
                                  THEN NULLIF(patch->>'recurrence_until', '')::date
                                  ELSE recurrence_until END,
    recurrence_days_of_week = CASE WHEN patch ? 'recurrence_days_of_week'
                                   THEN ARRAY(SELECT (jsonb_array_elements_text(patch->'recurrence_days_of_week'))::integer)
                                   ELSE recurrence_days_of_week END,
    recurrence_exceptions  = CASE WHEN patch ? 'recurrence_exceptions'
                                  THEN ARRAY(SELECT (jsonb_array_elements_text(patch->'recurrence_exceptions'))::date)
                                  ELSE recurrence_exceptions END,
    updated_at             = now()
  WHERE id = event_id;

  RETURN event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_user_emails(p_ids uuid[])
 RETURNS TABLE(id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$ BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF; RETURN QUERY SELECT u.id, u.email::text FROM auth.users u WHERE u.id = ANY(p_ids); END; $function$;

CREATE OR REPLACE FUNCTION public.broadcast_claim_post(p_id uuid)
 RETURNS TABLE(id uuid, kind text, caption text, asset_urls text[], platform text, credentials text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with claimed as (
    update public.social_posts p
       set status = 'publishing',
           attempts = p.attempts + 1
     where p.id = p_id
       and p.status in ('queued', 'failed')
       and p.attempts < 5
    returning p.id, p.kind, p.caption, p.asset_urls, p.account_id
  )
  select c.id, c.kind, c.caption, c.asset_urls, a.platform, a.credentials
    from claimed c
    join public.social_accounts a on a.id = c.account_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.social_posts (event_id, account_id, kind, caption, asset_urls, status)
  values (p_event_id, p_account_id, p_kind, coalesce(p_caption, ''), coalesce(p_asset_urls, '{}'), 'queued')
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('published', 'failed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.social_posts
     set status = p_status,
         external_id = p_external_id,
         external_url = p_external_url,
         error = p_error,
         published_at = case when p_status = 'published' then now() else published_at end
   where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_list_accounts()
 RETURNS TABLE(id uuid, platform text, label text, handle text, status text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.platform, a.label, a.handle, a.status, a.created_at
    from public.social_accounts a
   where public.is_admin()
   order by a.created_at asc
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_list_posts(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, kind text, caption text, status text, external_url text, error text, created_at timestamp with time zone, published_at timestamp with time zone, event_title text, account_label text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.kind, p.caption, p.status, p.external_url, p.error,
         p.created_at, p.published_at,
         e.title as event_title,
         a.label as account_label
    from public.social_posts p
    left join public.events e on e.id = p.event_id
    join public.social_accounts a on a.id = p.account_id
   where public.is_admin()
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select id into v_id
    from public.social_accounts
   where platform = p_platform and handle = p_handle;

  if v_id is null then
    insert into public.social_accounts (platform, label, handle, credentials, meta)
    values (p_platform, p_label, p_handle, p_credentials, p_meta)
    returning id into v_id;
  else
    update public.social_accounts
       set label = p_label,
           credentials = p_credentials,
           meta = p_meta,
           status = 'connected',
           updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid DEFAULT NULL::uuid, p_raw text DEFAULT NULL::text, p_device_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_result    text;
  v_ticket    tickets%ROWTYPE;
  v_tier_name text;
  v_attendee  text;
  v_when      timestamptz;
  v_issued    int;
  v_in        int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_ticket_id IS NULL THEN
    v_result := 'bad_signature';
  ELSE
    SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
      v_result := 'not_found';
    ELSIF v_ticket.event_id <> p_event_id THEN
      v_result := 'wrong_event';
    ELSE
      UPDATE tickets
        SET status = 'checked_in', checked_in_at = now()
        WHERE id = p_ticket_id AND status = 'valid'
        RETURNING * INTO v_ticket;
      IF FOUND THEN
        v_result := 'ok';
      ELSE
        SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
        v_result := CASE v_ticket.status
          WHEN 'checked_in' THEN 'duplicate'
          WHEN 'void'       THEN 'void'
          WHEN 'refunded'   THEN 'refunded'
          ELSE 'not_found'
        END;
      END IF;
      v_when := v_ticket.checked_in_at;
      SELECT t.name INTO v_tier_name FROM ticket_tiers t WHERE t.id = v_ticket.tier_id;
      SELECT COALESCE(v_ticket.attendee_name, u.email)
        INTO v_attendee
        FROM auth.users u WHERE u.id = v_ticket.owner_user_id;
    END IF;
  END IF;

  INSERT INTO ticket_scans (ticket_id, event_id, scanned_by, result, raw, device_note)
  VALUES (
    CASE WHEN v_result IN ('bad_signature','not_found') THEN NULL ELSE p_ticket_id END,
    p_event_id, v_uid, v_result, p_raw, p_device_note
  );

  -- Two plain counts on purpose: FILTER-aggregates directly before plpgsql's
  -- INTO clause trip the plpgsql parser (syntax error at or near INTO).
  SELECT count(*)::int INTO v_issued
    FROM tickets WHERE event_id = p_event_id AND status IN ('valid','checked_in');
  SELECT count(*)::int INTO v_in
    FROM tickets WHERE event_id = p_event_id AND status = 'checked_in';

  RETURN jsonb_build_object(
    'result', v_result,
    'serial', v_ticket.serial,
    'tier_name', v_tier_name,
    'attendee', v_attendee,
    'checked_in_at', v_when,
    'payment_due_at_door', COALESCE(v_ticket.payment_due_at_door, false),
    'stats', jsonb_build_object('issued', v_issued, 'checked_in', v_in)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_tier       ticket_tiers%ROWTYPE;
  v_ev_status  text;
  v_ev_civic   boolean;
  v_ev_listing text;
  v_ev_over    boolean;
  v_ev_org     uuid;
  v_email      text;
  v_have       int;
  v_avail      int;
  v_order_id   uuid;
  v_item_id    uuid;
  v_serial     text;
  v_tickets    jsonb := '[]'::jsonb;
  v_tid        uuid;
  i            int;
  attempt      int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;

  SELECT * INTO v_tier FROM ticket_tiers WHERE id = p_tier_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tier_not_found';
  END IF;

  SELECT e.status, e.is_civic, e.listing_status, e.organizer_id,
         (COALESCE(e.end_date, e.date)
            < (now() AT TIME ZONE COALESCE(e.timezone, 'Europe/Tirane'))::date)
    INTO v_ev_status, v_ev_civic, v_ev_listing, v_ev_org, v_ev_over
  FROM events e WHERE e.id = v_tier.event_id;

  IF v_ev_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'event_not_published';
  END IF;
  -- v1 policy: civic events never ticket through this machine at all
  -- (attendance vocabulary only — bible pledge).
  IF v_ev_civic THEN
    RAISE EXCEPTION 'civic_not_ticketed';
  END IF;
  IF v_ev_listing = 'cancelled' THEN
    RAISE EXCEPTION 'event_cancelled';
  END IF;
  IF v_ev_over THEN
    RAISE EXCEPTION 'event_ended';
  END IF;

  IF v_tier.status <> 'active' THEN
    RAISE EXCEPTION 'tier_not_active';
  END IF;
  IF v_tier.visibility <> 'public' THEN
    RAISE EXCEPTION 'tier_not_available';        -- unlock codes are TIX-4
  END IF;
  IF v_tier.price_cents <> 0 THEN
    RAISE EXCEPTION 'paid_not_available';        -- paid tiers unlock with PAY
  END IF;
  IF v_tier.sales_start IS NOT NULL AND v_tier.sales_start > now() THEN
    RAISE EXCEPTION 'sales_not_started';
  END IF;
  IF v_tier.sales_end IS NOT NULL AND v_tier.sales_end <= now() THEN
    RAISE EXCEPTION 'sales_ended';
  END IF;
  IF p_quantity > v_tier.max_per_order THEN
    RAISE EXCEPTION 'over_max_per_order';
  END IF;

  -- Per-user-per-event cap: repeat orders must not drain free inventory
  -- (decision log 2026-07-12). Counted across the EVENT, not just the tier.
  SELECT count(*)::int INTO v_have
  FROM tickets tk
  WHERE tk.event_id = v_tier.event_id
    AND tk.owner_user_id = v_uid
    AND tk.status IN ('valid','checked_in');
  IF v_have + p_quantity > v_tier.max_per_order THEN
    RAISE EXCEPTION 'user_cap_reached';
  END IF;

  v_avail := tier_available(p_tier_id);
  IF v_avail IS NULL OR v_avail < p_quantity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO orders (user_id, event_id, organizer_id, status, provider,
                      subtotal_cents, fee_cents, payment_cents, total_cents,
                      currency, contact_email, paid_at)
  VALUES (v_uid, v_tier.event_id, v_ev_org, 'paid', 'free',
          0, 0, 0, 0, v_tier.currency, v_email, now())
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, tier_id, quantity, unit_price_cents, unit_fee_cents)
  VALUES (v_order_id, p_tier_id, p_quantity, 0, 0)
  RETURNING id INTO v_item_id;

  FOR i IN 1..p_quantity LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      v_serial := generate_ticket_serial();
      BEGIN
        INSERT INTO tickets (order_item_id, event_id, tier_id, owner_user_id, serial)
        VALUES (v_item_id, v_tier.event_id, p_tier_id, v_uid, v_serial)
        RETURNING id INTO v_tid;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt >= 5 THEN
          RAISE EXCEPTION 'serial_collision';
        END IF;
      END;
    END LOOP;
    v_tickets := v_tickets || jsonb_build_object('id', v_tid, 'serial', v_serial);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'event_id', v_tier.event_id,
    'tickets', v_tickets
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
  DECLARE
    v_user_id uuid := auth.uid();
  BEGIN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.organizers (
      id, display_name, slug, contact_email, website_url
    ) VALUES (
      v_user_id, p_display_name, p_slug, p_contact_email, p_website_url
    );

    INSERT INTO public.organizer_onboarding_responses (
      organizer_id, event_types, attendee_age_ranges,
      expected_attendance_size, expected_yearly_revenue, events_per_year
    ) VALUES (
      v_user_id,
      COALESCE(p_event_types, '{}'),
      COALESCE(p_attendee_age_ranges, '{}'),
      p_expected_attendance_size,
      p_expected_yearly_revenue,
      p_events_per_year
    );

    RETURN v_user_id;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.door_snapshot(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN jsonb_build_object(
    'tickets',
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'v', t.qr_version, 's', t.status))
              FROM tickets t WHERE t.event_id = p_event_id), '[]'::jsonb),
    'stats', (SELECT jsonb_build_object(
        'issued', count(*) FILTER (WHERE status IN ('valid','checked_in')),
        'checked_in', count(*) FILTER (WHERE status = 'checked_in'))
      FROM tickets WHERE event_id = p_event_id)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.events_search_vector_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_serial()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'ALB-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_event_civic_flip()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.is_civic AND NOT OLD.is_civic AND EXISTS (
    SELECT 1 FROM ticket_tiers t
    WHERE t.event_id = NEW.id AND t.price_cents > 0 AND t.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'event_with_paid_tiers_cannot_become_civic';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_tier_not_paid_civic()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.price_cents > 0 AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.is_civic
  ) THEN
    RAISE EXCEPTION 'civic_events_cannot_have_paid_tiers';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  BEGIN
    INSERT INTO public.profiles (id, email, role, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      'user',
      now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
  $function$;

CREATE OR REPLACE FUNCTION public.organizer_avatar_url(p_organizer_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.avatar_url
  from public.profiles p
  join public.organizers o on o.id = p.id
  where p.id = p_organizer_id
$function$;

CREATE OR REPLACE FUNCTION public.organizer_create_event(input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
  DECLARE
    v_organizer_id uuid;
    v_event_id uuid;
  BEGIN
    SELECT id INTO v_organizer_id FROM organizers WHERE id = auth.uid();
    IF v_organizer_id IS NULL THEN
      RAISE EXCEPTION 'not_organizer';
    END IF;
    INSERT INTO events (
      title, slug, category, description, date, time, price,
      location_slug, country, region, place_id,
      organizer_id, origin, status
    ) VALUES (
      input->>'title', input->>'slug', input->>'category', input->>'description',
      (input->>'date')::date, input->>'time', input->>'price',
      input->>'location_slug', input->>'country', input->>'region',
      CASE WHEN input->>'place_id' IS NOT NULL THEN (input->>'place_id')::uuid END,
      v_organizer_id, 'organizer_dashboard', 'draft'
    ) RETURNING id INTO v_event_id;
    RETURN v_event_id;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.organizer_create_event_v2(input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid      uuid := auth.uid();
  has_org  boolean;
  new_id   uuid;
  raw_slug text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.organizers WHERE id = uid) INTO has_org;

  IF NOT has_org THEN
    RAISE EXCEPTION 'not_organizer' USING ERRCODE = '42501';
  END IF;

  raw_slug := COALESCE(NULLIF(input->>'slug', ''),
                       lower(regexp_replace(coalesce(input->>'title','event'), '[^a-z0-9]+', '-', 'g')));

  INSERT INTO public.events (
    title, slug, place_id, category, description,
    date, end_date, time, end_time, timezone,
    price, status, country, region, location_slug,
    lat, lng, address,
    is_online, online_url,
    tags, language,
    organizer_id, origin, banner_url,
    organizer_name, organizer_phone, organizer_website, organizer_socials,
    is_civic, event_type, featured_movement_slug,
    organizer_contact, telegram_link, whatsapp_link,
    safety_notes, expected_attendees,
    recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions
  ) VALUES (
    input->>'title',
    raw_slug || '-' || substring(replace(gen_random_uuid()::text, '-', '') for 8),
    NULLIF(input->>'place_id', '')::uuid,
    COALESCE(NULLIF(input->>'category', ''), 'culture'),
    COALESCE(input->>'description', ''),
    (input->>'date')::date,
    NULLIF(input->>'end_date', '')::date,
    input->>'time',
    input->>'end_time',
    COALESCE(NULLIF(input->>'timezone', ''), 'Europe/Tirane'),
    input->>'price',
    'draft',
    COALESCE(NULLIF(input->>'country', ''), 'Albania'),
    input->>'region',
    COALESCE(NULLIF(input->>'location_slug', ''), 'tirana'),
    NULLIF(input->>'lat', '')::double precision,
    NULLIF(input->>'lng', '')::double precision,
    input->>'address',
    COALESCE((input->>'is_online')::boolean, false),
    input->>'online_url',
    CASE WHEN input->'tags' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(input->'tags'))
      ELSE '{}'::text[]
    END,
    COALESCE(NULLIF(input->>'language', ''), 'en'),
    uid,
    'organizer_dashboard',
    input->>'banner_url',
    input->>'organizer_name',
    input->>'organizer_phone',
    input->>'organizer_website',
    NULLIF(input->'organizer_socials', 'null'::jsonb),
    COALESCE((input->>'is_civic')::boolean, false),
    input->>'event_type',
    input->>'featured_movement_slug',
    input->>'organizer_contact',
    input->>'telegram_link',
    input->>'whatsapp_link',
    input->>'safety_notes',
    NULLIF(input->>'expected_attendees', '')::integer,
    COALESCE(NULLIF(input->>'recurrence', ''), 'none'),
    NULLIF(input->>'recurrence_until', '')::date,
    CASE WHEN input->'recurrence_days_of_week' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements_text(input->'recurrence_days_of_week'))::integer)
      ELSE '{}'::integer[]
    END,
    CASE WHEN input->'recurrence_exceptions' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements_text(input->'recurrence_exceptions'))::date)
      ELSE '{}'::date[]
    END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_issued int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM events e WHERE e.id = p_event_id AND e.is_civic) THEN
    RAISE EXCEPTION 'civic_not_ticketed';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_capacity IS NULL OR p_capacity < 1 THEN RAISE EXCEPTION 'bad_capacity'; END IF;
  IF p_max_per_order IS NULL OR p_max_per_order < 1 OR p_max_per_order > 10 THEN
    RAISE EXCEPTION 'bad_max_per_order';
  END IF;
  IF p_sales_start IS NOT NULL AND p_sales_end IS NOT NULL
     AND p_sales_end <= p_sales_start THEN
    RAISE EXCEPTION 'bad_sales_window';
  END IF;

  IF p_tier_id IS NULL THEN
    INSERT INTO ticket_tiers (event_id, name, description, price_cents, capacity,
                              max_per_order, sales_start, sales_end, sort_order)
    VALUES (p_event_id, trim(p_name), NULLIF(trim(COALESCE(p_description,'')),''), 0,
            p_capacity, p_max_per_order, p_sales_start, p_sales_end,
            COALESCE(p_sort_order, 0))
    RETURNING id INTO v_id;
  ELSE
    -- Capacity may never drop below what is already issued.
    SELECT count(*)::int INTO v_issued
    FROM tickets WHERE tier_id = p_tier_id AND status IN ('valid','checked_in');
    IF p_capacity < v_issued THEN
      RAISE EXCEPTION 'capacity_below_issued';
    END IF;
    UPDATE ticket_tiers
      SET name = trim(p_name),
          description = NULLIF(trim(COALESCE(p_description,'')),''),
          capacity = p_capacity,
          max_per_order = p_max_per_order,
          sales_start = p_sales_start,
          sales_end = p_sales_end,
          sort_order = COALESCE(p_sort_order, sort_order)
      WHERE id = p_tier_id AND event_id = p_event_id
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  END IF;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_event uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_status NOT IN ('active','paused','archived') THEN
    RAISE EXCEPTION 'bad_status';
  END IF;
  SELECT event_id INTO v_event FROM ticket_tiers WHERE id = p_tier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = v_event AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE ticket_tiers SET status = p_status WHERE id = p_tier_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.organizer_submit_event(event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  DECLARE
    v_status text;
  BEGIN
    SELECT status INTO v_status FROM events
    WHERE id = event_id AND organizer_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found_or_not_owner'; END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
      RAISE EXCEPTION 'invalid_transition: cannot move % to pending_review', v_status;
    END IF;
    UPDATE events SET status = 'pending_review', updated_at = now() WHERE id = event_id;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.organizer_update_event(event_id uuid, input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid     uuid := auth.uid();
  org_row public.organizers%rowtype;
  ev_row  public.events%rowtype;
  target_status text;
  gallery text[];
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into org_row from public.organizers where id = uid;
  if not found then
    raise exception 'not_organizer' using errcode = '42501';
  end if;

  select * into ev_row
    from public.events e
   where e.id = organizer_update_event.event_id
     and e.organizer_id = uid;
  if not found then
    raise exception 'not_found_or_not_owner';
  end if;

  if ev_row.status not in ('draft', 'rejected', 'published') then
    raise exception 'invalid_status';
  end if;

  target_status := case org_row.verification_tier
                     when 'verified'    then 'published'
                     when 'established' then 'published'
                     else                    'draft'
                   end;

  if input->'gallery_urls' is not null and jsonb_typeof(input->'gallery_urls') = 'array' then
    gallery := array(select jsonb_array_elements_text(input->'gallery_urls'));
  elsif input->>'banner_url' is not null and length(input->>'banner_url') > 0 then
    gallery := array[input->>'banner_url'];
  else
    gallery := '{}'::text[];
  end if;

  update public.events e set
    title                   = input->>'title',
    category                = coalesce(nullif(input->>'category', ''), 'culture'),
    description             = coalesce(input->>'description', ''),
    date                    = (input->>'date')::date,
    time                    = input->>'time',
    end_time                = input->>'end_time',
    timezone                = coalesce(nullif(input->>'timezone', ''), 'Europe/Tirane'),
    price                   = input->>'price',
    status                  = target_status,
    country                 = coalesce(nullif(input->>'country', ''), 'Albania'),
    region                  = input->>'region',
    location_slug           = coalesce(nullif(input->>'location_slug', ''), 'tirana'),
    lat                     = nullif(input->>'lat', '')::double precision,
    lng                     = nullif(input->>'lng', '')::double precision,
    address                 = input->>'address',
    address_hint            = input->>'address_hint',
    is_online               = coalesce((input->>'is_online')::boolean, false),
    online_url              = input->>'online_url',
    tags                    = case when input->'tags' is not null
                                then array(select jsonb_array_elements_text(input->'tags'))
                                else '{}'::text[]
                              end,
    language                = coalesce(nullif(input->>'language', ''), 'en'),
    gallery_urls            = gallery,
    organizer_name          = input->>'organizer_name',
    organizer_phone         = input->>'organizer_phone',
    organizer_website       = input->>'organizer_website',
    organizer_socials       = nullif(input->'organizer_socials', 'null'::jsonb),
    is_civic                = coalesce((input->>'is_civic')::boolean, false),
    event_type              = input->>'event_type',
    featured_movement_slug  = input->>'featured_movement_slug',
    organizer_contact       = input->>'organizer_contact',
    telegram_link           = input->>'telegram_link',
    whatsapp_link           = input->>'whatsapp_link',
    safety_notes            = input->>'safety_notes',
    expected_attendees      = nullif(input->>'expected_attendees', '')::integer,
    recurrence              = coalesce(nullif(input->>'recurrence', ''), 'none'),
    recurrence_until        = nullif(input->>'recurrence_until', '')::date,
    recurrence_days_of_week = case when input->'recurrence_days_of_week' is not null
                                then array(select (v.value::text)::int
                                             from jsonb_array_elements(input->'recurrence_days_of_week') v)
                                else '{}'::int[]
                              end,
    recurrence_exceptions   = case when input->'recurrence_exceptions' is not null
                                then array(select (v.value::text)::date
                                             from jsonb_array_elements(input->'recurrence_exceptions') v)
                                else '{}'::date[]
                              end,
    title_i18n              = null,
    description_i18n        = null,
    updated_at              = now()
  where e.id = organizer_update_event.event_id;

  return ev_row.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.places_search_vector_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.public_submission_review_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from event_submissions
  where status in ('approved', 'rejected');
$function$;

CREATE OR REPLACE FUNCTION public.series_demand_counts(p_series_id uuid)
 RETURNS TABLE(city_slug text, city_label text, country text, requests bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.city_slug,
         mode() within group (order by d.city_label) as city_label,
         mode() within group (order by d.country)    as country,
         count(*)                                    as requests
    from public.series_demand d
    join public.event_series s on s.id = d.series_id
   where d.series_id = p_series_id
     and s.status = 'published'
   group by d.city_slug
   order by count(*) desc, d.city_slug asc;
$function$;

CREATE OR REPLACE FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.events e set
    content_sections = public._normalize_media_sections(p_sections),
    cover_in_gallery = coalesce(p_cover_in_gallery, true),
    updated_at       = now()
  where e.id = p_event_id
    and (e.organizer_id = uid or public.is_admin());

  if not found then
    raise exception 'not_found_or_not_owner';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.event_submissions s set
    content_sections = public._normalize_media_sections(p_sections),
    cover_in_gallery = coalesce(p_cover_in_gallery, true)
  where s.id = p_submission_id
    and (s.submitted_by_user_id = uid or public.is_admin());

  if not found then
    raise exception 'not_found_or_not_owner';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.submit_event_submission(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_id    uuid := auth.uid();
  caller_role  text;
  hour_count   integer;
  day_count    integer;
  new_id       uuid;
  v_title      text;
  v_date       text;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  v_title := nullif(trim(coalesce(p_payload->>'title', '')), '');
  if v_title is null then
    raise exception 'title is required';
  end if;

  v_date := nullif(trim(coalesce(p_payload->>'date', '')), '');
  if v_date is null then
    raise exception 'date is required';
  end if;

  select role into caller_role
    from public.profiles
    where id = caller_id;

  if coalesce(caller_role, '') <> 'admin' then
    select count(*) into hour_count
      from public.event_submissions
      where submitted_by_user_id = caller_id
        and created_at >= now() - interval '1 hour';

    if hour_count >= 3 then
      raise exception 'Rate limit: max 3 event submissions per hour. Try again later.';
    end if;

    select count(*) into day_count
      from public.event_submissions
      where submitted_by_user_id = caller_id
        and created_at >= now() - interval '24 hours';

    if day_count >= 10 then
      raise exception 'Rate limit: max 10 event submissions per day. Try again tomorrow.';
    end if;
  end if;

  insert into public.event_submissions (
    title, title_i18n, venue_name, place_id, date, end_date, time, end_time, timezone,
    category, price, contact_email, description, description_i18n,
    country, region, location_slug, lat, lng, address, address_hint,
    is_online, online_url, tags, language, gallery_urls, status,
    submitted_by_user_id,
    event_type, is_civic, featured_movement_slug,
    organizer_name, organizer_contact, organizer_phone, organizer_website,
    organizer_socials, telegram_link, whatsapp_link, safety_notes,
    expected_attendees,
    recurrence, recurrence_until, recurrence_days_of_week, recurrence_exceptions
  )
  values (
    v_title,
    case when jsonb_typeof(p_payload->'title_i18n') = 'object'
         then p_payload->'title_i18n' else null::jsonb end,
    nullif(trim(coalesce(p_payload->>'venue_name', '')), ''),
    case when nullif(p_payload->>'place_id', '') is not null
         then (p_payload->>'place_id')::uuid
         else null end,
    v_date::date,
    case when nullif(p_payload->>'end_date', '') is not null
          and (p_payload->>'end_date') > v_date
         then (p_payload->>'end_date')::date
         else null end,
    nullif(p_payload->>'time', '')::time,
    nullif(p_payload->>'end_time', '')::time,
    nullif(p_payload->>'timezone', ''),
    coalesce(nullif(p_payload->>'category', ''), 'culture'),
    nullif(p_payload->>'price', ''),
    nullif(p_payload->>'contact_email', ''),
    coalesce(p_payload->>'description', ''),
    case when jsonb_typeof(p_payload->'description_i18n') = 'object'
         then p_payload->'description_i18n' else null::jsonb end,
    coalesce(nullif(p_payload->>'country', ''), 'Unknown'),
    nullif(p_payload->>'region', ''),
    coalesce(nullif(p_payload->>'location_slug', ''), 'unknown'),
    case when (p_payload->>'lat') ~ '^-?[0-9]+\.?[0-9]*$'
         then (p_payload->>'lat')::numeric
         else null end,
    case when (p_payload->>'lng') ~ '^-?[0-9]+\.?[0-9]*$'
         then (p_payload->>'lng')::numeric
         else null end,
    nullif(p_payload->>'address', ''),
    nullif(p_payload->>'address_hint', ''),
    coalesce((p_payload->>'is_online')::boolean, false),
    nullif(p_payload->>'online_url', ''),
    case when jsonb_typeof(p_payload->'tags') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'tags'))::text[]
         else '{}'::text[] end,
    coalesce(nullif(p_payload->>'language', ''), 'en'),
    case when jsonb_typeof(p_payload->'gallery_urls') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'gallery_urls'))::text[]
         else '{}'::text[] end,
    'pending',
    caller_id,
    nullif(p_payload->>'event_type', ''),
    coalesce((p_payload->>'is_civic')::boolean, false),
    nullif(p_payload->>'featured_movement_slug', ''),
    nullif(p_payload->>'organizer_name', ''),
    nullif(p_payload->>'organizer_contact', ''),
    nullif(p_payload->>'organizer_phone', ''),
    nullif(p_payload->>'organizer_website', ''),
    case when jsonb_typeof(p_payload->'organizer_socials') = 'object'
         then p_payload->'organizer_socials'
         else null::jsonb end,
    nullif(p_payload->>'telegram_link', ''),
    nullif(p_payload->>'whatsapp_link', ''),
    nullif(p_payload->>'safety_notes', ''),
    case when (p_payload->>'expected_attendees') ~ '^[0-9]+$'
         then (p_payload->>'expected_attendees')::integer
         else null end,
    coalesce(nullif(p_payload->>'recurrence', ''), 'none'),
    nullif(p_payload->>'recurrence_until', '')::date,
    case when jsonb_typeof(p_payload->'recurrence_days_of_week') = 'array'
         then array(select (jsonb_array_elements_text(p_payload->'recurrence_days_of_week'))::integer)::integer[]
         else '{}'::integer[] end,
    case when jsonb_typeof(p_payload->'recurrence_exceptions') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'recurrence_exceptions')::date)
         else '{}'::date[] end
  )
  returning id into new_id;

  return new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_display_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  meta_name text;
begin
  meta_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name'
  );

  if meta_name is null or trim(meta_name) = '' then
    return new;
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, meta_name)
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tier_available(p_tier_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.capacity
    - COALESCE((SELECT count(*)::int FROM tickets tk
                WHERE tk.tier_id = t.id AND tk.status IN ('valid','checked_in')), 0)
    - COALESCE((SELECT sum(oi.quantity)::int
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.tier_id = t.id
                  AND o.status = 'pending'
                  AND o.expires_at > now()), 0)
  FROM ticket_tiers t
  WHERE t.id = p_tier_id;
$function$;

CREATE OR REPLACE FUNCTION public.update_event_series_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.title, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(new.subtitle, '')), 'B')
   || setweight(to_tsvector('simple', coalesce(new.summary, '')), 'C')
   || setweight(to_tsvector('simple', coalesce(array_to_string(new.tags, ' '), '')), 'C')
   || setweight(to_tsvector('simple', coalesce(new.description, '')), 'D');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_events_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C');
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.update_places_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C');
    RETURN NEW;
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text DEFAULT NULL::text, p_zoom double precision DEFAULT 12.5)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.upsert_event_series(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_id   uuid := auth.uid();
  caller_role text;
  is_org      boolean;
  v_id        uuid;
  v_slug      text;
  v_title     text;
  existing    public.event_series%rowtype;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into caller_role from public.profiles where id = caller_id;
  select exists(select 1 from public.organizers where id = caller_id) into is_org;

  if coalesce(caller_role, '') <> 'admin' and not is_org then
    raise exception 'Only admins and organizers can manage series';
  end if;

  v_id    := nullif(p_payload->>'id', '')::uuid;
  v_title := nullif(trim(coalesce(p_payload->>'title', '')), '');
  v_slug  := nullif(trim(lower(coalesce(p_payload->>'slug', ''))), '');

  if v_title is null then
    raise exception 'title is required';
  end if;
  if v_slug is null then
    raise exception 'slug is required';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug must be lowercase alphanumeric with single hyphens';
  end if;

  if v_id is not null then
    select * into existing from public.event_series where id = v_id;
    if not found then
      raise exception 'Series not found';
    end if;
    if coalesce(caller_role, '') <> 'admin'
       and existing.organizer_id is distinct from caller_id then
      raise exception 'You do not own this series';
    end if;
    v_slug := existing.slug;   -- slug is permanent, same policy as events.slug
  end if;

  insert into public.event_series as s (
    id, slug, kind, title, subtitle, summary, description, category, tags,
    poster_url, banner_url, gallery_urls, trailer_url, credits, official_url,
    organizer_id, is_civic, status, phase_override,
    title_i18n, summary_i18n, description_i18n
  )
  values (
    coalesce(v_id, gen_random_uuid()),
    v_slug,
    coalesce(nullif(p_payload->>'kind', ''), 'other'),
    v_title,
    nullif(p_payload->>'subtitle', ''),
    nullif(p_payload->>'summary', ''),
    nullif(p_payload->>'description', ''),
    coalesce(nullif(p_payload->>'category', ''), 'culture'),
    case when jsonb_typeof(p_payload->'tags') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'tags'))::text[]
         else '{}'::text[] end,
    nullif(p_payload->>'poster_url', ''),
    nullif(p_payload->>'banner_url', ''),
    case when jsonb_typeof(p_payload->'gallery_urls') = 'array'
         then array(select jsonb_array_elements_text(p_payload->'gallery_urls'))::text[]
         else '{}'::text[] end,
    nullif(p_payload->>'trailer_url', ''),
    case when jsonb_typeof(p_payload->'credits') = 'object'
         then p_payload->'credits' else '{}'::jsonb end,
    nullif(p_payload->>'official_url', ''),
    case when coalesce(caller_role, '') = 'admin'
         then nullif(p_payload->>'organizer_id', '')::uuid
         else caller_id end,
    coalesce((p_payload->>'is_civic')::boolean, false),
    coalesce(nullif(p_payload->>'status', ''), 'draft'),
    nullif(p_payload->>'phase_override', ''),
    case when jsonb_typeof(p_payload->'title_i18n') = 'object'
         then p_payload->'title_i18n' else null end,
    case when jsonb_typeof(p_payload->'summary_i18n') = 'object'
         then p_payload->'summary_i18n' else null end,
    case when jsonb_typeof(p_payload->'description_i18n') = 'object'
         then p_payload->'description_i18n' else null end
  )
  on conflict (id) do update set
    kind             = excluded.kind,
    title            = excluded.title,
    subtitle         = excluded.subtitle,
    summary          = excluded.summary,
    description      = excluded.description,
    category         = excluded.category,
    tags             = excluded.tags,
    poster_url       = excluded.poster_url,
    banner_url       = excluded.banner_url,
    gallery_urls     = excluded.gallery_urls,
    trailer_url      = excluded.trailer_url,
    credits          = excluded.credits,
    official_url     = excluded.official_url,
    organizer_id     = coalesce(excluded.organizer_id, s.organizer_id),
    is_civic         = excluded.is_civic,
    status           = excluded.status,
    phase_override   = excluded.phase_override,
    title_i18n       = excluded.title_i18n,
    summary_i18n     = excluded.summary_i18n,
    description_i18n = excluded.description_i18n
  returning s.id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_ticket(p_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_event uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT event_id INTO v_event FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = v_event AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE tickets SET status = 'void' WHERE id = p_ticket_id AND status = 'valid';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RAISE EXCEPTION 'ticket_not_voidable'; END IF;
END; $function$;

-- ---------- FUNCTION EXECUTE PRIVILEGES ----------
REVOKE ALL ON FUNCTION public._normalize_media_sections(p_sections jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._normalize_media_sections(p_sections jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public._normalize_media_sections(p_sections jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public._normalize_media_sections(p_sections jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public._normalize_media_sections(p_sections jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._normalize_media_sections(p_sections jsonb) TO service_role;
REVOKE ALL ON FUNCTION public._sync_event_banner_from_gallery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._sync_event_banner_from_gallery() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public._sync_event_banner_from_gallery() TO postgres;
GRANT EXECUTE ON FUNCTION public._sync_event_banner_from_gallery() TO anon;
GRANT EXECUTE ON FUNCTION public._sync_event_banner_from_gallery() TO authenticated;
GRANT EXECUTE ON FUNCTION public._sync_event_banner_from_gallery() TO service_role;
REVOKE ALL ON FUNCTION public._sync_organizer_verified_flag() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._sync_organizer_verified_flag() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public._sync_organizer_verified_flag() TO postgres;
GRANT EXECUTE ON FUNCTION public._sync_organizer_verified_flag() TO anon;
GRANT EXECUTE ON FUNCTION public._sync_organizer_verified_flag() TO authenticated;
GRANT EXECUTE ON FUNCTION public._sync_organizer_verified_flag() TO service_role;
REVOKE ALL ON FUNCTION public.admin_confirm_user_email(target_user uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(target_user uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(target_user uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(target_user uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(target_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(target_user uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(target_user uuid, also_delete_events boolean) TO service_role;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;
REVOKE ALL ON FUNCTION public.admin_publish_event(event_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_event(event_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_event(event_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_publish_event(event_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_event(event_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_event(event_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_reject_event(event_id uuid, note text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_event(event_id uuid, note text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_event(event_id uuid, note text) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_reject_event(event_id uuid, note text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_event(event_id uuid, note text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_event(event_id uuid, note text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_repost_event(source_event_id uuid, new_date date, new_time text, new_end_time text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_studio_access(target_user uuid, allowed boolean) TO service_role;
REVOKE ALL ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(target_user uuid, new_role text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_event(event_id uuid, patch jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.admin_user_emails(p_ids uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(p_ids uuid[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(p_ids uuid[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(p_ids uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(p_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(p_ids uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_claim_post(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_claim_post(p_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_claim_post(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_claim_post(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_claim_post(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_claim_post(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_create_post(p_event_id uuid, p_account_id uuid, p_kind text, p_caption text, p_asset_urls text[]) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_finish_post(p_id uuid, p_status text, p_external_id text, p_external_url text, p_error text) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_list_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_list_accounts() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_list_accounts() TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_list_accounts() TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_list_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_list_accounts() TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_list_posts(p_limit integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_list_posts(p_limit integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_list_posts(p_limit integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_list_posts(p_limit integer) TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_list_posts(p_limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_list_posts(p_limit integer) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_upsert_account(p_platform text, p_label text, p_handle text, p_credentials text, p_meta jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid, p_raw text, p_device_note text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid, p_raw text, p_device_note text) TO postgres;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid, p_raw text, p_device_note text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid, p_raw text, p_device_note text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(p_event_id uuid, p_ticket_id uuid, p_raw text, p_device_note text) TO service_role;
REVOKE ALL ON FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(p_tier_id uuid, p_quantity integer) TO service_role;
REVOKE ALL ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) TO postgres;
GRANT EXECUTE ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organizer(p_display_name text, p_slug text, p_contact_email text, p_website_url text, p_event_types text[], p_attendee_age_ranges text[], p_expected_attendance_size text, p_expected_yearly_revenue text, p_events_per_year text) TO service_role;
REVOKE ALL ON FUNCTION public.door_snapshot(p_event_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.door_snapshot(p_event_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.door_snapshot(p_event_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.door_snapshot(p_event_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.door_snapshot(p_event_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.events_search_vector_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.events_search_vector_update() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.events_search_vector_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.events_search_vector_update() TO anon;
GRANT EXECUTE ON FUNCTION public.events_search_vector_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.events_search_vector_update() TO service_role;
REVOKE ALL ON FUNCTION public.generate_ticket_serial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_ticket_serial() TO postgres;
GRANT EXECUTE ON FUNCTION public.generate_ticket_serial() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_ticket_serial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ticket_serial() TO service_role;
REVOKE ALL ON FUNCTION public.guard_event_civic_flip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_event_civic_flip() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_event_civic_flip() TO postgres;
GRANT EXECUTE ON FUNCTION public.guard_event_civic_flip() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_event_civic_flip() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_event_civic_flip() TO service_role;
REVOKE ALL ON FUNCTION public.guard_tier_not_paid_civic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_tier_not_paid_civic() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_tier_not_paid_civic() TO postgres;
GRANT EXECUTE ON FUNCTION public.guard_tier_not_paid_civic() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_tier_not_paid_civic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_tier_not_paid_civic() TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
REVOKE ALL ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_avatar_url(p_organizer_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_create_event(input jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_create_event(input jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_create_event(input jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_create_event(input jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_create_event(input jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_create_event(input jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_create_event_v2(input jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(input jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(input jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(input jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(input jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_create_event_v2(input jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_save_tier(p_event_id uuid, p_tier_id uuid, p_name text, p_description text, p_capacity integer, p_max_per_order integer, p_sales_start timestamp with time zone, p_sales_end timestamp with time zone, p_sort_order integer) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_set_tier_status(p_tier_id uuid, p_status text) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_submit_event(event_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_submit_event(event_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_submit_event(event_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_submit_event(event_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_submit_event(event_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_submit_event(event_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.organizer_update_event(event_id uuid, input jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.places_search_vector_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.places_search_vector_update() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.places_search_vector_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.places_search_vector_update() TO anon;
GRANT EXECUTE ON FUNCTION public.places_search_vector_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.places_search_vector_update() TO service_role;
REVOKE ALL ON FUNCTION public.public_submission_review_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_submission_review_count() TO postgres;
GRANT EXECUTE ON FUNCTION public.public_submission_review_count() TO anon;
GRANT EXECUTE ON FUNCTION public.public_submission_review_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_submission_review_count() TO service_role;
REVOKE ALL ON FUNCTION public.series_demand_counts(p_series_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.series_demand_counts(p_series_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.series_demand_counts(p_series_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.series_demand_counts(p_series_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.series_demand_counts(p_series_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.series_demand_counts(p_series_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_media(p_event_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO service_role;
REVOKE ALL ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_submission_media(p_submission_id uuid, p_sections jsonb, p_cover_in_gallery boolean) TO service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.submit_event_submission(p_payload jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_submission(p_payload jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_submission(p_payload jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_event_submission(p_payload jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_event_submission(p_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_submission(p_payload jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.sync_profile_display_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_display_name() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_display_name() TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_profile_display_name() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_display_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_display_name() TO service_role;
REVOKE ALL ON FUNCTION public.tier_available(p_tier_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tier_available(p_tier_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.tier_available(p_tier_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.tier_available(p_tier_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tier_available(p_tier_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.update_event_series_search_vector() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_series_search_vector() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_series_search_vector() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_event_series_search_vector() TO anon;
GRANT EXECUTE ON FUNCTION public.update_event_series_search_vector() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_series_search_vector() TO service_role;
REVOKE ALL ON FUNCTION public.update_events_search_vector() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_events_search_vector() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_events_search_vector() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_events_search_vector() TO anon;
GRANT EXECUTE ON FUNCTION public.update_events_search_vector() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_events_search_vector() TO service_role;
REVOKE ALL ON FUNCTION public.update_places_search_vector() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_places_search_vector() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_places_search_vector() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_places_search_vector() TO anon;
GRANT EXECUTE ON FUNCTION public.update_places_search_vector() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_places_search_vector() TO service_role;
REVOKE ALL ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) TO postgres;
GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_city_from_event(p_slug text, p_name text, p_country text, p_lat double precision, p_lng double precision, p_country_code text, p_zoom double precision) TO service_role;
REVOKE ALL ON FUNCTION public.upsert_event_series(p_payload jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_event_series(p_payload jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_event_series(p_payload jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.upsert_event_series(p_payload jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_event_series(p_payload jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_event_series(p_payload jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.void_ticket(p_ticket_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_ticket(p_ticket_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.void_ticket(p_ticket_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.void_ticket(p_ticket_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_ticket(p_ticket_id uuid) TO service_role;

-- ---------- TRIGGERS ----------
CREATE TRIGGER event_series_search_vector_update BEFORE INSERT OR UPDATE ON public.event_series FOR EACH ROW EXECUTE FUNCTION update_event_series_search_vector();
CREATE TRIGGER event_series_set_updated_at BEFORE UPDATE ON public.event_series FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER event_submissions_sync_banner_from_gallery BEFORE INSERT OR UPDATE OF gallery_urls ON public.event_submissions FOR EACH ROW EXECUTE FUNCTION _sync_event_banner_from_gallery();
CREATE TRIGGER "event-changed-notify" AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://albago.org/api/notifications/event-changed', 'POST', '{"Content-type":"application/json","x-webhook-secret":"548ac008753b72b7394d8273772018b364274e642c198b7de6c9ab1d9d130077"}', '{}', '5000');
CREATE TRIGGER events_civic_tier_guard BEFORE UPDATE OF is_civic ON public.events FOR EACH ROW EXECUTE FUNCTION guard_event_civic_flip();
CREATE TRIGGER events_search_vector_trigger BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();
CREATE TRIGGER events_search_vector_update BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION update_events_search_vector();
CREATE TRIGGER events_sync_banner_from_gallery BEFORE INSERT OR UPDATE OF gallery_urls ON public.events FOR EACH ROW EXECUTE FUNCTION _sync_event_banner_from_gallery();
CREATE TRIGGER organizers_set_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organizers_sync_verified_flag BEFORE INSERT OR UPDATE OF verification_tier ON public.organizers FOR EACH ROW EXECUTE FUNCTION _sync_organizer_verified_flag();
CREATE TRIGGER places_search_vector_trigger BEFORE INSERT OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION places_search_vector_update();
CREATE TRIGGER places_search_vector_update BEFORE INSERT OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION update_places_search_vector();
CREATE TRIGGER ticket_tiers_civic_guard BEFORE INSERT OR UPDATE ON public.ticket_tiers FOR EACH ROW EXECUTE FUNCTION guard_tier_not_paid_civic();
CREATE TRIGGER ticket_tiers_set_updated_at BEFORE UPDATE ON public.ticket_tiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- ROW LEVEL SECURITY ----------
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_import_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_admin_select ON public.ai_usage AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY cities_admin_write ON public.cities AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY cities_public_read ON public.cities AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY crawl_sources_admin_all ON public.crawl_sources AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY event_import_candidates_admin_all ON public.event_import_candidates AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY event_series_delete_admin ON public.event_series AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY event_series_select_admin ON public.event_series AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY event_series_select_owner ON public.event_series AS PERMISSIVE FOR SELECT TO public USING ((organizer_id = auth.uid()));
CREATE POLICY event_series_select_published ON public.event_series AS PERMISSIVE FOR SELECT TO public USING ((status = 'published'::text));
CREATE POLICY event_submissions_delete_admin ON public.event_submissions AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY submissions_admin_delete ON public.event_submissions AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY submissions_admin_update ON public.event_submissions AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY submissions_select ON public.event_submissions AS PERMISSIVE FOR SELECT TO public USING (((submitted_by_user_id = auth.uid()) OR is_admin()));
CREATE POLICY admins_update_events ON public.events AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY events_admin_write ON public.events AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY events_insert_organizer ON public.events AS PERMISSIVE FOR INSERT TO public WITH CHECK (((organizer_id = auth.uid()) AND (status = 'draft'::text) AND (origin = 'organizer_dashboard'::text)));
CREATE POLICY events_select_owner ON public.events AS PERMISSIVE FOR SELECT TO public USING ((organizer_id = auth.uid()));
CREATE POLICY events_select_published ON public.events AS PERMISSIVE FOR SELECT TO public USING ((status = 'published'::text));
CREATE POLICY interactions_select_admin ON public.interactions AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY order_items_select ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
           FROM events e
          WHERE ((e.id = o.event_id) AND (e.organizer_id = auth.uid())))))))));
CREATE POLICY orders_select ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = orders.event_id) AND (e.organizer_id = auth.uid()))))));
CREATE POLICY organizer_event_reports_insert_authenticated ON public.organizer_event_reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((reporter_user_id = auth.uid()));
CREATE POLICY organizer_event_reports_select_admin ON public.organizer_event_reports AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY organizer_event_reports_update_admin ON public.organizer_event_reports AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY onboarding_delete_admin ON public.organizer_onboarding_responses AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY onboarding_insert_self ON public.organizer_onboarding_responses AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = organizer_id));
CREATE POLICY onboarding_select_self_or_admin ON public.organizer_onboarding_responses AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = organizer_id) OR is_admin()));
CREATE POLICY onboarding_update_self ON public.organizer_onboarding_responses AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = organizer_id)) WITH CHECK ((auth.uid() = organizer_id));
CREATE POLICY organizers_delete_admin ON public.organizers AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY organizers_insert_self ON public.organizers AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY organizers_select_public ON public.organizers AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY organizers_update_self_or_admin ON public.organizers AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = id) OR is_admin())) WITH CHECK (((auth.uid() = id) OR is_admin()));
CREATE POLICY "Public can read places" ON public.places AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY places_admin_write ON public.places AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY places_public_read ON public.places AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY profiles_select ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = id) OR is_admin()));
CREATE POLICY profiles_update ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY profiles_update_own_preferences ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY saved_events_delete_own ON public.saved_events AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY saved_events_insert_own ON public.saved_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY saved_events_select_own ON public.saved_events AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY series_demand_select_admin ON public.series_demand AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY series_demand_select_owner ON public.series_demand AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM event_series s
  WHERE ((s.id = series_demand.series_id) AND (s.organizer_id = auth.uid())))));
CREATE POLICY ticket_scans_select ON public.ticket_scans AS PERMISSIVE FOR SELECT TO authenticated USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = ticket_scans.event_id) AND (e.organizer_id = auth.uid()))))));
CREATE POLICY ticket_tiers_select ON public.ticket_tiers AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((((visibility = 'public'::text) AND (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = ticket_tiers.event_id) AND (e.status = 'published'::text))))) OR is_admin() OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = ticket_tiers.event_id) AND (e.organizer_id = auth.uid()))))));
CREATE POLICY tickets_select ON public.tickets AS PERMISSIVE FOR SELECT TO authenticated USING (((owner_user_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = tickets.event_id) AND (e.organizer_id = auth.uid()))))));
CREATE POLICY "Public can submit volunteer signups" ON public.volunteer_signups AS PERMISSIVE FOR INSERT TO anon,authenticated WITH CHECK (true);
CREATE POLICY volunteer_signups_select_admin ON public.volunteer_signups AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY volunteer_signups_update_admin ON public.volunteer_signups AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---------- TABLE PRIVILEGES ----------
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_usage TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_usage TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_usage TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cities TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cities TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.cities TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.crawl_sources TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.crawl_sources TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.crawl_sources TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_import_candidates TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_import_candidates TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_import_candidates TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_series TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_series TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_series TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_submissions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_submissions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_submissions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interactions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interactions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interactions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.order_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.order_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.order_items TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_event_reports TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_event_reports TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_event_reports TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_onboarding_responses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_onboarding_responses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizer_onboarding_responses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizers TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.places TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.places TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.places TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.push_subscriptions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.push_subscriptions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.push_subscriptions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.saved_events TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.saved_events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.saved_events TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.series_demand TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.series_demand TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.series_demand TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_accounts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_accounts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_accounts TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_campaigns TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_campaigns TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_campaigns TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_posts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_posts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.social_posts TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_scans TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_scans TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_scans TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_tiers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_tiers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ticket_tiers TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tickets TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tickets TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tickets TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.volunteer_signups TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.volunteer_signups TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.volunteer_signups TO service_role;
