# Next 24 hours — founder checklist (2026-07-06 evening)

Do these in order. Nothing here requires Claude.

## A. Browser QA before commit (10 min, `npm run dev`)

Switch language to **SQ** in the navbar, then:

- [ ] Homepage: search placeholder "Kërko evente...", section headings in Albanian, movement banner, "Kërko" button
- [ ] /events: "Kthehu" pill, "Të gjitha eventet në Tiranë", nonsense search → "Nuk u gjetën evente për …"
- [ ] Any event card + protest card: Albanian month/weekday, "Qytetare" chip, "X të pritur"
- [ ] Event detail → Share: modal fully Albanian ("Shpërndaje këtë event", "Kopjo linkun")
- [ ] /submit-event logged out: "Fillo tani, hyr më vonë"
- [ ] /faq: no gap where the Pankartat question was
- [ ] /about: "Real photos, real people" card reads naturally without "Pankartat"
- [ ] Footer: no Pankartat link
- [ ] Type /pankartat directly: still loads (dormant, noindexed — that's correct)
- [ ] Mobile menu + EN once (no raw key names like `home_search_button`)

## B. Commit (only after A passes)

**NEVER `git add .` — a secret file has sat untracked in this tree before.** Exact command:

```
git add lib/i18n/translations.ts app/faq/page.tsx app/about/page.tsx app/pankartat/page.tsx app/sitemap.ts app/protests/ProtestsClient.tsx app/HomeClient.tsx app/events/EventsClient.tsx components/cinematic/ProtestCard.tsx components/share/ShareModal.tsx app/submit-event/SubmitEventClient.tsx components/layout/Footer.tsx "app/movements/[slug]/MovementClient.tsx" app/events/albanian-revolution/AlbanianRevolutionClient.tsx app/protests/edi-rama-berlin-2026/EdiRamaBerlinClient.tsx app/press/page.tsx docs/ops/i18n-sprint-handoff.md docs/ops/opus-continuation-prompt.md docs/ops/next-24-hours-founder-checklist.md
```

```
git commit -m "feat(i18n): localize homepage, events, share + submit flows; disconnect Pankartat from public

- 74 new keys x 4 languages (all blocks verified at 337-key parity)
- HomeClient, EventsClient, ProtestCard, ShareModal, SubmitEventClient,
  ProtestsClient wired to t(); ProtestCard dates locale-aware
- Pankartat: links removed from footer, movement page, revolution hub,
  Edi Rama Berlin page, press page, sitemap; FAQ entry removed; about
  mention neutralized; /pankartat noindexed (feature code untouched)"
```

## C. Push + deploy

- [ ] `git push`
- [ ] vercel.com → project → confirm deployment goes green
- [ ] On albago.org (SQ): homepage, /events, /protests, /submit-event all render Albanian

## D. Manual dashboard tasks (30 min total, overdue)

1. [ ] **resend.com → API keys → rotate/delete old key, create new**
2. [ ] **Vercel → Settings → Environment Variables → update `RESEND_API_KEY`** (Production + Preview)
3. [ ] **Redeploy** (Vercel → Deployments → Redeploy) so the new key is live
4. [ ] **search.google.com/search-console** → property `albago.org` → Sitemaps → submit `https://albago.org/sitemap.xml`
5. [ ] Google Cloud Console → OAuth consent screen → check verification status + callback URLs
6. [ ] Sentry: if you've made the project, paste the DSN into the next Claude session
7. [ ] **One real /submit-event E2E test in production** (logged in, full wizard, confirm it lands in admin queue)

## E. Analytics review (Supabase SQL editor, 5 min daily)

```sql
-- last 20 interactions
select created_at, type, target, utm_source from interactions order by created_at desc limit 20;

-- yesterday by type
select type, count(*) from interactions where created_at > now() - interval '1 day' group by 1 order by 2 desc;

-- traffic sources (7d, unique sessions)
select utm_source, count(distinct session_id) from interactions where utm_source is not null and created_at > now() - interval '7 days' group by 1 order by 2 desc;

-- top searches (7d)
select metadata->>'q' as q, count(*) from interactions where type = 'search_query' and created_at > now() - interval '7 days' group by 1 order by 2 desc limit 10;

-- returning sessions (seen on 2+ distinct days, last 7d)
select count(*) from (
  select session_id from interactions where created_at > now() - interval '7 days'
  group by session_id having count(distinct date_trunc('day', created_at)) > 1
) r;

-- table size
select count(*) as rows, pg_size_pretty(pg_total_relation_size('interactions')) as size from interactions;
```

## F. Outreach — daily minimum (the actual job, plan §4/§7)

- [ ] 20 organizer/venue/page DMs (script in operating plan §4)
- [ ] 10 event/source confirmations (real events verified and entered)
- [ ] 1 Instagram or TikTok post (Reel export tooling exists — use it)
- [ ] **Every link you share carries UTM**: `?utm_source=ig`, `?utm_source=tiktok`, `?utm_source=wa`, `?utm_source=tg` — no naked links, ever. This is the entire "which channel works" answer.

## G. Next Claude/Opus session — exact order

1. Read `docs/ops/opus-continuation-prompt.md` first (it has everything).
2. Implement the **language cookie** (§12 of that doc) so server components can read the language.
3. **Localize the event detail page** (`app/events/[slug]/page.tsx`) — biggest remaining surface.
4. Add the **trust layer** on event/protest detail: Burimi, Përditësuar së fundmi, Hape në Google Maps, Kopjo adresën, Raporto korrigjim (mailto), "Je organizatori? Merre eventin në kontroll" → /become-organizer link.
5. **No new features.** No Pankartat. No RSVP/push/follows/admin polish. Plan §9 rules the month.
