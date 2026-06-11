'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Mail,
  Shield,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type UserRow = {
  id: string
  email: string
  email_confirmed_at: string | null
  role: 'admin' | 'user'
  is_organizer: boolean
}

type Stats = {
  total: number
  admins: number
  organizers: number
  unconfirmed: number
}

export default function UserStatsCard() {
  const supabase = useMemo(() => createClient(), [])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc('admin_list_users')
      if (!mounted) return
      if (rpcError) {
        if (
          /admin_list_users/i.test(rpcError.message) &&
          /does not exist/i.test(rpcError.message)
        ) {
          setError('Apply docs/seeds/phase-14-admin-users.sql to enable.')
        } else {
          setError(rpcError.message)
        }
        return
      }
      const rows = (data ?? []) as UserRow[]
      setStats({
        total: rows.length,
        admins: rows.filter((u) => u.role === 'admin').length,
        organizers: rows.filter((u) => u.is_organizer).length,
        unconfirmed: rows.filter((u) => !u.email_confirmed_at).length,
      })
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
            Users
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Account roster
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Confirm grandfathered accounts and manage admin access.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 rounded-full bg-flame-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(238,28,37,0.35)] transition hover:bg-flame-400"
        >
          Manage users
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          {error}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total accounts"
            value={stats?.total ?? null}
            icon={<UsersIcon className="h-4 w-4" />}
          />
          <StatTile
            label="Admins"
            value={stats?.admins ?? null}
            icon={<Shield className="h-4 w-4 text-flame-300" />}
          />
          <StatTile
            label="Organizers"
            value={stats?.organizers ?? null}
            icon={<Building2 className="h-4 w-4 text-sky-300" />}
          />
          <StatTile
            label="Unconfirmed"
            value={stats?.unconfirmed ?? null}
            icon={<Mail className="h-4 w-4 text-amber-300" />}
            tone={stats && stats.unconfirmed > 0 ? 'warn' : undefined}
          />
        </div>
      )}
    </section>
  )
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number | null
  icon: React.ReactNode
  tone?: 'warn'
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/[0.06]'
      : 'border-white/10 bg-white/[0.03]'
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-3xl text-white">
        {value === null ? '…' : value}
      </div>
    </div>
  )
}
