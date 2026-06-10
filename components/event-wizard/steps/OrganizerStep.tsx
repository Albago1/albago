'use client'

import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Camera,
  Globe,
  Hash,
  MessageCircle,
  Music2,
  Phone,
  User2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { fetchOrganizer } from '@/lib/organizers'
import type { EventDraft } from '@/types/eventDraft'
import type { Organizer } from '@/types/organizer'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
  mode: 'community' | 'organizer'
}

type SocialKey = 'instagram' | 'facebook' | 'tiktok' | 'twitter'

export default function OrganizerStep({ draft, patch, mode }: Props) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const supabase = createClient()
      const org = await fetchOrganizer(supabase)
      if (!mounted) return
      setOrganizer(org)

      // Only prefill if both name + contact are empty so the user's edits
      // are never overwritten.
      if (org && !draft.organizer_name.trim() && !draft.organizer_contact.trim()) {
        patch({
          organizer_name: org.display_name,
          organizer_contact: org.contact_email,
          organizer_website: draft.organizer_website || org.website_url || '',
        })
        setPrefilled(true)
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSocial = (key: SocialKey, value: string) =>
    patch({
      organizer_socials: { ...draft.organizer_socials, [key]: value },
    })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {mode === 'organizer' ? 'Organizer details' : 'Who is hosting?'}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            {mode === 'organizer'
              ? 'These show on every event card you publish. Edit anything you want for this event only.'
              : 'Tell attendees who is behind this event. Required so we can verify legitimacy before approving.'}
          </p>
        </div>
        {organizer?.verified && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        )}
      </div>

      {prefilled && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-100">
          Prefilled from your organizer profile. Edit any field as needed for
          this event.
        </div>
      )}

      <Field label="Organizer name" htmlFor="org-name" required>
        <div className="relative">
          <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="org-name"
            type="text"
            required
            value={draft.organizer_name}
            onChange={(e) => patch({ organizer_name: e.target.value })}
            placeholder='e.g. "Folie Marina", "Komiteti Civic"'
            className="input pl-10"
          />
        </div>
      </Field>

      <Field label="Contact email" htmlFor="org-email" required>
        <input
          id="org-email"
          type="email"
          required
          value={draft.organizer_contact}
          onChange={(e) => patch({ organizer_contact: e.target.value })}
          placeholder="hello@example.com"
          className="input"
        />
        <p className="mt-1 text-xs text-white/45">
          Only visible to moderators. Attendees won&apos;t see this address.
        </p>
      </Field>

      <Field label="Phone (optional)" htmlFor="org-phone">
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="org-phone"
            type="tel"
            value={draft.organizer_phone}
            onChange={(e) => patch({ organizer_phone: e.target.value })}
            placeholder="+355 ..."
            className="input pl-10"
          />
        </div>
      </Field>

      <Field label="Website (optional)" htmlFor="org-website">
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="org-website"
            type="url"
            value={draft.organizer_website}
            onChange={(e) => patch({ organizer_website: e.target.value })}
            placeholder="https://..."
            className="input pl-10"
          />
        </div>
      </Field>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          Social handles (optional)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SocialInput
            label="Instagram"
            icon={<Camera className="h-4 w-4" />}
            value={draft.organizer_socials.instagram ?? ''}
            onChange={(v) => setSocial('instagram', v)}
            placeholder="@yourhandle"
          />
          <SocialInput
            label="Facebook"
            icon={<MessageCircle className="h-4 w-4" />}
            value={draft.organizer_socials.facebook ?? ''}
            onChange={(v) => setSocial('facebook', v)}
            placeholder="facebook.com/your.page"
          />
          <SocialInput
            label="TikTok"
            icon={<Music2 className="h-4 w-4" />}
            value={draft.organizer_socials.tiktok ?? ''}
            onChange={(v) => setSocial('tiktok', v)}
            placeholder="@yourhandle"
          />
          <SocialInput
            label="X / Twitter"
            icon={<Hash className="h-4 w-4" />}
            value={draft.organizer_socials.twitter ?? ''}
            onChange={(v) => setSocial('twitter', v)}
            placeholder="@yourhandle"
          />
        </div>
      </div>

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

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-white/55"
      >
        {label}
        {required && <span className="ml-1 text-flame-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function SocialInput(props: {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const id = `social-${props.label.toLowerCase().replace(/\W+/g, '')}`
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45"
      >
        {props.label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
          {props.icon}
        </span>
        <input
          id={id}
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="input pl-10"
        />
      </div>
    </div>
  )
}
