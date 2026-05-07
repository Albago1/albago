# AlbaGo — Project Context

## 🚀 Product Overview

**AlbaGo** is a map-first event and place discovery platform for Albania.

Core idea:
→ Help users decide **where to go tonight in under 30 seconds**

Focus:
- Fast decisions
- Clean UI
- Mobile-first experience
- Real-world usability (not a demo)

---

## 🧱 Tech Stack

- Next.js (App Router)
- Tailwind CSS (dark premium UI)
- MapLibre (map engine via adapter)
- Static data (events + places)
- No backend yet (planned later)
- No auth yet (planned later)

---

## 🧠 Architecture

### Map System
- Uses **adapter pattern**
- Current provider: MapLibre
- Easily switchable later

Files:
- `map.types.ts` → interface
- `maplibreAdapter.ts` → implementation
- `MapView.tsx` → logic (provider-independent)

---

## 📍 App Structure

### Routes

- `/` → Landing page (discovery)
- `/map` → Interactive map
- `/events` → Event list
- `/submit-event` → (placeholder)

---

## 📁 Core Files (IMPORTANT)

### 🔥 Map Core
- `components/map/MapView.tsx`
  - map logic
  - filters
  - markers
  - place selection

- `components/map/maplibreAdapter.ts`
  - map rendering
  - marker handling
  - flyTo logic

---

### 📍 UI Core
- `components/place/PlacePanel.tsx`
  - place details
  - event display
  - mobile bottom sheet (swipe to close)

- `components/layout/FilterBar.tsx`
  - time + category filters
  - result counters

- `components/layout/LandingNavbar.tsx`
  - top navigation
  - hidden on map page

---

### 🌐 Pages
- `app/page.tsx` → Landing page
- `app/map/page.tsx` → Map wrapper
- `app/events/page.tsx` → Events list
- `app/submit-event/page.tsx` → placeholder

---

## 📊 Data Models

### Event
```ts
export type Event = {
  id: string
  title: string
  date: string
  time: string
  placeId: string
  description: string
  category?: string
  price?: string
  highlight?: boolean
}

export type Place = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  description: string
  options: string[]
  imageUrl?: string
}

Data Flow
events → filtered by time
filtered events → determine visible places
visible places → markers on map
selected place → opens PlacePanel
PlacePanel → shows related events
🎯 Current Features
✅ Implemented
Interactive map (MapLibre)
Category filtering
Time filtering (all / tonight / weekend)
Place selection
Place panel (mobile optimized)
Swipe-to-close on mobile
Landing page (Eventbrite-inspired)
Event list page
Navigation flow (landing → map → panel)
❌ Not Implemented Yet
🚧 High Priority
🌍 Language system (EN / DE / ES / AL)
➕ Event submission (no backend yet)
🧠 Decision UX improvements
🔜 Next
🏙️ Country + city system
🔗 Real backend (Supabase likely)
🔐 Authentication
🎨 Design Direction
Dark UI
Premium feel
Inspired by:
Eventbrite (structure)
Modern SaaS
Minimal friction
Fast navigation
⚙️ Constraints
NO overengineering
NO complex backend yet
NO auth yet
MVP first
Code must be:
clean
simple
copy-paste ready
🧠 Development Philosophy
Build for speed + clarity
Every feature must help:
→ user decide faster

Avoid:

unnecessary steps
heavy UI
complexity
🔁 How to Continue in New Chat
Always provide:
This PROJECT_CONTEXT.md
The file you want to modify
Example:
Use this project context.

Now modify this file:
[paste MapView.tsx]
🧭 Current Focus (NEXT TASK)

Start with:

🌍 Language System

Requirements:

Lightweight (no heavy libraries)
Global usage
Easy to extend
Works in:
landing page
map
place panel

Then continue with:

Event submission page
UX improvements
🧩 Notes
Mobile testing works best via deployed version (Vercel)
Local phone testing may fail due to JS bundle loading issues
Map provider can be swapped later via adapter