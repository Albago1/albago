'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  Mail,
  MailCheck,
  Search,
  Shield,
  ShieldOff,
  Users as UsersIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type UserRow = {
  id: string
  email: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  role: 'admin' | 'user'
}

type Filter = 'all' | 'admins' | 'unconfirmed'

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export default function UsersClient({
  currentUserId,
}: {
  currentUserId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_list_users')
    setLoading(false)
    if (rpcError) {
      console.error('admin_list_users:', rpcError)
      if (rpcError.code === '42501' || /not_admin/i.test(rpcError.message)) {
        setError('Not authorized. Re-check your admin role on the profiles table.')
        return
      }
      if (/admin_list_users/i.test(rpcError.message) && /does not exist/i.test(rpcError.message)) {
        setError(
          'admin_list_users RPC missing. Apply docs/seeds/phase-14-admin-users.sql in Supabase Studio.',
        )
        return
      }
      setError(rpcError.message)
      return
    }
    setUsers((data ?? []) as UserRow[])
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'admins' && u.role !== 'admin') return false
      if (filter === 'unconfirmed' && u.email_confirmed_at) return false
      if (q && !u.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, filter, search])

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      unconfirmed: users.filter((u) => !u.email_confirmed_at).length,
    }),
    [users],
  )

  const flashToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const confirmEmail = async (u: UserRow) => {
    if (u.email_confirmed_at) return
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_confirm_user_email', {
      target_user: u.id,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_confirm_user_email:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) =>
        row.id === u.id
          ? { ...row, email_confirmed_at: new Date().toISOString() }
          : row,
      ),
    )
    flashToast(`Confirmed ${u.email}.`)
  }

  const setRole = async (u: UserRow, next: 'admin' | 'user') => {
    if (u.id === currentUserId && next === 'user') {
      if (
        !window.confirm(
          'You are about to demote your own account. You will lose admin access. Continue?',
        )
      ) {
        return
      }
    }
    setBusyId(u.id)
    const { error: rpcError } = await supabase.rpc('admin_set_user_role', {
      target_user: u.id,
      new_role: next,
    })
    setBusyId(null)
    if (rpcError) {
      console.error('admin_set_user_role:', rpcError)
      flashToast(`Failed: ${rpcError.message}`)
      return
    }
    setUsers((prev) =>
      prev.map((row) => (row.id === u.id ? { ...row, role: next } : row)),
    )
    flashToast(`${u.email} is now ${next}.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin"
        className="mb-3 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to admin
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-white/55">
            Every account on AlbaGo. Confirm emails for grandfathered users and
            promote trusted accounts to admin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Stat label="Total" value={stats.total} icon={<UsersIcon className="h-3.5 w-3.5" />} />
          <Stat label="Admins" value={stats.admins} icon={<Shield className="h-3.5 w-3.5" />} />
          <Stat
            label="Unconfirmed"
            value={stats.unconfirmed}
            icon={<Mail className="h-3.5 w-3.5" />}
            tone="warn"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        <FilterChip
          active={filter === 'admins'}
          onClick={() => setFilter('admins')}
        >
          Admins
        </FilterChip>
        <FilterChip
          active={filter === 'unconfirmed'}
          onClick={() => setFilter('unconfirmed')}
        >
          Unconfirmed
        </FilterChip>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email..."
            className="h-10 w-full rounded-full border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25"
          />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-white/55">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/55">
          No users match this filter.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId
                const confirmed = !!u.email_confirmed_at
                const busy = busyId === u.id
                return (
                  <tr
                    key={u.id}
                    className="border-t border-white/[0.06] transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-white/90">
                        {u.email}
                      </div>
                      {isSelf && (
                        <div className="mt-0.5 text-[10px] text-flame-400">
                          you
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {confirmed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                          <BadgeCheck className="h-3 w-3" />
                          Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                          <Mail className="h-3 w-3" />
                          Unconfirmed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-flame-500/10 px-2.5 py-1 text-[11px] font-semibold text-flame-200 ring-1 ring-flame-500/30">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-white/55">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/55">
                      {timeAgo(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/55">
                      {timeAgo(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!confirmed && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => confirmEmail(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            title="Mark email as confirmed"
                          >
                            <MailCheck className="h-3 w-3" />
                            Confirm
                          </button>
                        )}
                        {u.role === 'user' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRole(u, 'admin')}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-flame-500/20 hover:text-flame-100 disabled:opacity-50"
                            title="Promote to admin"
                          >
                            <Shield className="h-3 w-3" />
                            Make admin
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRole(u, 'user')}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/65 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                            title="Demote to user"
                          >
                            <ShieldOff className="h-3 w-3" />
                            Demote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-ink-900/95 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'warn'
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-100'
      : 'border-white/10 bg-white/[0.04] text-white/85'
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${toneCls}`}
    >
      {icon}
      <span className="font-mono text-sm">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
        {label}
      </span>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-flame-500/40 bg-flame-500/15 text-flame-100'
          : 'border-white/10 bg-white/[0.04] text-white/65 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
