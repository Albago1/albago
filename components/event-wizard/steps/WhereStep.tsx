'use client'

import { useEffect, useState } from 'react'
import { Globe2, Link as LinkIcon, MapPin } from 'lucide-react'
import LocationAutocomplete, {
  type ResolvedAddress,
} from '@/components/location/LocationAutocomplete'
import type { EventDraft } from '@/types/eventDraft'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
}

function draftToResolved(draft: EventDraft): ResolvedAddress | null {
  if (draft.lat == null || draft.lng == null) return null
  return {
    slug: draft.location_slug || 'unknown',
    city: draft.city || null,
    country: draft.country || null,
    countryCode: null,
    region: draft.region || null,
    address: draft.address || null,
    road: null,
    houseNumber: null,
    postcode: null,
    displayName: [draft.address, draft.city, draft.country]
      .filter(Boolean)
      .join(', '),
    lat: draft.lat,
    lng: draft.lng,
    placeId: draft.location_slug || `${draft.lat},${draft.lng}`,
    type: null,
  }
}

export default function WhereStep({ draft, patch }: Props) {
  // Local search query for the LocationAutocomplete input. Prefilled from the
  // draft if the user already resolved a location on a previous visit.
  const [query, setQuery] = useState<string>(() =>
    draft.address || draft.city || draft.location_slug || '',
  )

  const [resolved, setResolved] = useState<ResolvedAddress | null>(() =>
    draftToResolved(draft),
  )

  // If the draft is changed externally (e.g. the user hit "Reset draft"),
  // re-sync the local resolved view.
  useEffect(() => {
    if (draft.lat == null || draft.lng == null) {
      setResolved(null)
      return
    }
    setResolved((prev) => prev ?? draftToResolved(draft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.lat, draft.lng])

  const handleResolve = (next: ResolvedAddress | null) => {
    setResolved(next)
    if (!next) {
      patch({
        location_slug: '',
        country: '',
        region: '',
        city: '',
        lat: null,
        lng: null,
      })
      return
    }
    // Don't auto-fill draft.address — it's the static label the submitter
    // writes themselves and what users actually read on the event page.
    // The geocoder only feeds lat/lng + city/country/region for the map pin.
    patch({
      location_slug: next.slug || draft.location_slug,
      country: next.country ?? draft.country,
      region: next.region ?? '',
      city: next.city ?? '',
      lat: next.lat,
      lng: next.lng,
    })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Where is it?</h2>

      {/* Online toggle */}
      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => patch({ is_online: false })}
          className={[
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            !draft.is_online
              ? 'bg-white text-black'
              : 'text-white/65 hover:text-white',
          ].join(' ')}
        >
          <MapPin className="h-3.5 w-3.5" />
          Physical place
        </button>
        <button
          type="button"
          onClick={() => patch({ is_online: true })}
          className={[
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            draft.is_online
              ? 'bg-white text-black'
              : 'text-white/65 hover:text-white',
          ].join(' ')}
        >
          <Globe2 className="h-3.5 w-3.5" />
          Online
        </button>
      </div>

      {draft.is_online ? (
        <div className="space-y-3">
          <label
            htmlFor="where-online-url"
            className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
          >
            Online URL
            <span className="ml-1 text-flame-400">*</span>
          </label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              id="where-online-url"
              type="url"
              required
              value={draft.online_url}
              onChange={(e) => patch({ online_url: e.target.value })}
              placeholder="https://zoom.us/j/..."
              className="input pl-10"
            />
          </div>
          <p className="text-xs text-white/45">
            Zoom, Google Meet, Twitch, YouTube Live, or any joinable URL. Visitors
            will see this link once the event is published.
          </p>

          {/* Even online events get a tagged city for discovery (optional). */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
              Tag a city (optional)
            </p>
            <p className="text-xs text-white/45">
              People can still find your online event when they browse a city. Skip
              if it&apos;s truly worldwide.
            </p>
            <LocationAutocomplete
              id="where-online-city"
              value={query}
              onChange={setQuery}
              onResolve={handleResolve}
              resolved={resolved}
              placeholder="Search a city..."
              showMap={false}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="where-search"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              Pin the location on the map
              <span className="ml-1 text-flame-400">*</span>
            </label>
            <LocationAutocomplete
              id="where-search"
              value={query}
              onChange={setQuery}
              onResolve={handleResolve}
              resolved={resolved}
              placeholder='Search a street + number (e.g. "Rruga Murat Toptani 1, Tirana")'
              mapHeightClass="h-64"
              required
            />
            <p className="mt-1 text-xs text-white/45">
              We use this to drop the pin on the AlbaGo map. Pick the closest
              match — you&apos;ll write the version people read in the next field.
            </p>
          </div>

          <div>
            <label
              htmlFor="where-address-alias"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              Address as you want it shown
              {draft.lat != null && <span className="ml-1 text-flame-400">*</span>}
            </label>
            <textarea
              id="where-address-alias"
              rows={2}
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder='Write the full clear address. Example: "Rruga e Durrësit 219, Tirana 1001, near Komiteti"'
              className="input resize-none"
            />
            <p className="mt-1 text-xs text-white/45">
              This is what attendees actually read on the event page. Spell it
              out fully — street, number, area, landmarks. Don&apos;t rely on
              just the map.
            </p>
          </div>

          <div>
            <label
              htmlFor="where-venue"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              Venue name (optional)
            </label>
            <input
              id="where-venue"
              type="text"
              value={draft.venue_name}
              onChange={(e) => patch({ venue_name: e.target.value })}
              placeholder='e.g. "Folie Marina", "Komiteti"'
              className="input"
            />
            <p className="mt-1 text-xs text-white/45">
              If the venue has a recognizable name, add it. Leave blank for
              outdoor / public locations.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        :global(.input::placeholder) {
          color: rgba(255, 255, 255, 0.35);
        }
        :global(.input:focus) {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  )
}
