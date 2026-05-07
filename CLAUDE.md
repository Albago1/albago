# CLAUDE.md

# AlbaGo — Project Context & Development Guide

## Overview

AlbaGo is a modern nightlife, events, venues, and local discovery platform initially focused on Albania and the Balkans, designed to scale internationally.

The product combines:

* Event discovery
* Interactive maps
* Trending venues
* Community event submissions
* Location-based exploration
* Real-time nightlife/activity browsing

The long-term vision is to become:

> “The Google Maps + Resident Advisor + Eventbrite hybrid for nightlife, local culture, tourism, and real-world discovery.”

---

# Core Product Philosophy

AlbaGo is NOT:

* a static tourism website
* a directory
* a traditional map app

AlbaGo IS:

* a live discovery platform
* mobile-first
* social-feeling
* event-driven
* location-centric
* modern and visually immersive

The UX should always feel:

* fluid
* premium
* clean
* minimal
* fast
* modern startup quality

Inspired by:

* Airbnb
* Resident Advisor
* Fever
* Google Maps
* Uber
* Apple Maps
* Instagram Explore

---

# Current Stack

## Frontend

* Next.js App Router
* TypeScript
* React
* TailwindCSS
* Lucide Icons

## Backend

* Supabase

## Database

* PostgreSQL (via Supabase)

## Deployment

* Vercel

---

# Current App Structure

## Main Pages

### `/`

Landing/Home page

Contains:

* Hero section
* Search experience
* Location selector
* Featured events
* Trending places
* CTA sections

---

### `/events`

Events discovery page

Supports:

* Location filtering
* Time filtering
* Search query filtering
* Category filtering

---

### `/map`

Interactive venue + event map

Should eventually support:

* Live map markers
* Venue clusters
* User location
* Dynamic filters
* Search radius
* Mobile bottom sheets

---

### `/submit-event`

Public event submission form.

Users can:

* submit events
* choose category
* add venue
* add description
* send contact email

Submissions are stored in Supabase.

---

### `/dashboard`

Admin dashboard.

Used for:

* approving events
* rejecting events
* moderation
* future analytics

---

# Core UX Rules

## Mobile First

The platform is designed primarily for mobile.

Every component must:

* look clean on phones first
* avoid desktop-only layouts
* maintain touch-friendly spacing
* feel app-like

---

## Search Experience

Search is one of the most important parts of the platform.

The search UX should:

* feel instant
* be visually clean
* support free typing
* support location suggestions
* support future autocomplete
* support current location

The search bar should eventually support:

* events
* venues
* categories
* cities
* countries
* coastlines
* online events

---

## Location Philosophy

Locations are NOT limited to cities.

The architecture must support:

* cities
* coastlines
* regions
* countries
* neighborhoods
* districts
* islands
* online events

Examples:

* Tirana
* Durrës
* Albanian Coast
* Berlin
* Ibiza
* Prishtina
* Online

---

# Location System

Current location system lives in:

```ts
/lib/locations.ts
```

Each location should contain:

```ts
{
  slug: string
  label: string
  country: string
  region?: string
  lat?: number
  lng?: number
}
```

Future additions:

* timezone
* popularity score
* featured image
* aliases
* search keywords

---

# Event System

Events are currently:

* manually seeded
* submitted by users
* stored in Supabase

Future:

* automated ingestion
* scraping APIs
* AI categorization
* recurring events
* promoter accounts

---

# Event Data Structure

```ts
type PublicEvent = {
  id: string
  title: string
  slug: string
  place_id: string | null
  category: string
  description: string
  date: string
  time: string
  price: string | null
  highlight: boolean | null
  status: string
  location_slug: string
  country: string
  region: string | null
}
```

---

# Venue System

Places represent:

* clubs
* bars
* restaurants
* cafes
* beaches
* cultural spaces
* sports venues

Future:

* ratings
* popularity
* live crowd indicators
* music genres
* social content
* opening hours

---

# UI Design Principles

## Visual Direction

The UI uses:

* dark backgrounds
* glassmorphism
* soft borders
* blur effects
* glowing gradients
* modern rounded layouts

DO:

* use blur
* use depth
* use spacing
* keep typography large and clean

DO NOT:

* overcrowd screens
* use sharp edges
* create dashboard-looking layouts
* make it look like enterprise software

---

# Typography

Typography should feel:

* cinematic
* premium
* bold
* minimal

Use:

* large headings
* concise subtitles
* short UI labels

Avoid:

* long paragraphs
* excessive text
* tiny font sizes

---

# Navigation Philosophy

Navigation should always feel:

* simple
* discoverable
* app-like

Users should quickly:

* search
* browse
* switch locations
* open maps
* discover events

---

# Important Current UX Decisions

## Home Page

The homepage now centers around:

1. Search
2. Location selection
3. Event discovery

The location system should NEVER feel hidden.

The user should instantly understand:

* where they are browsing
* how to change location
* how to search

---

# Search UX Rules

The search area should:

* visually resemble modern apps
* support typing
* support suggestions
* support future GPS
* support mobile ergonomics

Inspired by:

* Airbnb search
* Uber destination picker
* Google Maps search

---

# Current Location UX

The app:

* defaults to Tirana
* allows switching locations
* supports future GPS
* supports free typing
* supports predefined suggestions

Current planned suggestions:

* Use my current location
* Tirana
* Durrës
* Albanian Coast
* Prishtina
* Berlin
* Online

---

# Current Technical Direction

## State Management

Currently using:

* local component state

Future:

* Zustand or React Context if needed

Avoid overengineering.

---

# Database Philosophy

Supabase is the single source of truth.

Do NOT:

* hardcode production data long-term
* rely permanently on local arrays

Temporary seeded arrays are acceptable during development.

---

# Performance Priorities

Highest priorities:

1. Mobile speed
2. Smooth transitions
3. Search responsiveness
4. Clean UX

Avoid:

* unnecessary re-renders
* giant client bundles
* bloated dependencies

---

# Future Planned Features

## High Priority

* Real GPS support
* Search autocomplete
* Real event search
* Map clustering
* Dynamic filters
* Authentication
* Saved places
* User profiles
* Favorites

---

## Medium Priority

* AI recommendations
* Social sharing
* Push notifications
* Trending algorithms
* Venue analytics

---

## Long-Term Vision

* International rollout
* Native mobile apps
* Real-time nightlife density
* Creator/promoter tools
* Ticketing integration
* Partnerships with venues

---

# Coding Rules

## Components

Prefer:

* reusable UI
* small clean components
* composability

Avoid:

* giant monolithic files
* duplicated layouts

---

## Styling

Use:

* Tailwind only

Avoid:

* inline styles unless dynamic
* inconsistent spacing
* random colors

---

# Tailwind Style Language

Primary:

* blue
* violet
* white transparency

Main background:

```css
bg-[#070b14]
```

Common surfaces:

```css
bg-white/[0.03]
border-white/10
```

---

# UX Quality Bar

Every new feature should feel:

* startup-grade
* polished
* intuitive
* minimal

If a feature:

* feels clunky
* feels enterprise
* feels old-fashioned
* breaks mobile UX

…it should be redesigned.

---

# AI Assistant Instructions

When modifying this project:

ALWAYS:

* preserve mobile-first UX
* preserve visual consistency
* keep the UI premium
* think like a modern consumer app
* prioritize user discovery

NEVER:

* overcomplicate the interface
* introduce ugly default HTML styling
* break responsive layouts
* turn the app into an admin dashboard aesthetic

When uncertain:

* choose cleaner
* choose simpler
* choose more visual
* choose more intuitive

---

# Current Priority

Current active focus:

1. Professional search UX
2. Better location system
3. Events filtering
4. Dynamic Supabase data
5. Mobile polish
6. International scalability

---

# End Goal

AlbaGo should eventually feel like:

> “Open the app anywhere in the world and instantly discover what’s happening around you tonight.”
