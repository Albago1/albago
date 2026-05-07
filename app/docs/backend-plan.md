# AlbaGo Backend Plan

Public API-Key . sb_publishable_zuSrbhl6TQEPznAgISCPKQ_IAgny_zy

pROJECT url . https://stvjpcqcpmhngihfjhga.supabase.co

## Goal

Prepare AlbaGo for real events, real places, user submissions, moderation, and later authentication.
---

## Route Access Plan

### Public Routes

These pages are available to everyone:

- /
- /map
- /events
- /about
- /privacy
- /contact
- /sign-in
- /sign-up

---

### Logged-in User Routes

These require authentication:

- /submit-event
- /dashboard

User dashboard purpose:

- view submitted events
- see submission status
- edit pending submissions later

---

### Admin Routes

These require admin role:

- /admin
- /admin/submissions
- /admin/events
- /admin/places

Admin dashboard purpose:

- review event submissions
- approve or reject events
- manage published events
- manage places
- mark highlights
- archive old events

---

## Auth Rules

- Public visitors can browse the platform.
- Only logged-in users can submit events.
- Submitted events start as pending.
- Only admins can approve or reject submissions.
- Approved submissions become public events.
- Rejected submissions stay hidden from public pages.
---

## Core Tables

### places

Stores venues and locations shown on the map.

Fields:

- id
- name
- slug
- category
- description
- city
- address
- lat
- lng
- image_url
- options
- verified
- created_at
- updated_at

---

### events

Stores published events shown publicly.

Fields:

- id
- title
- slug
- place_id
- category
- description
- date
- time
- price
- highlight
- status
- created_at
- updated_at

Status values:

- published
- draft
- archived

---

### event_submissions

Stores user-submitted events before approval.

Fields:

- id
- title
- venue_name
- place_id
- category
- description
- date
- time
- price
- contact_email
- submitted_by_user_id
- status
- admin_note
- created_at
- updated_at

Status values:

- pending
- approved
- rejected

---

### users

Later authentication layer.

Fields:

- id
- email
- full_name
- role
- created_at

Role values:

- user
- organizer
- admin

---

## Launch Rule

Before launch, AlbaGo can run with curated static data.

After launch, real submissions should go into `event_submissions`.

Only approved submissions should become published `events`.

---

## MVP Backend Flow

1. User submits event.
2. Event goes into `event_submissions`.
3. Admin reviews submission.
4. If approved, admin creates or links place.
5. Approved event becomes a published event.
6. Published event appears on homepage, events page, and map.

---

## Important Rule

Submitted events should never publish directly without review.

This protects the quality and trust of AlbaGo.