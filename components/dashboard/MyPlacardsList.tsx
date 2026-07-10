'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Clock, ImagePlus, XCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export type MyPlacardCard = {
  id: string
  imageUrl: string
  caption: string | null
  city: string | null
  status: 'pending' | 'approved' | 'rejected'
  voteCount: number
  reportCount: number
  createdAt: string
  adminNote: string | null
}

function statusStyle(status: MyPlacardCard['status']) {
  if (status === 'approved')
    return {
      labelKey: 'status_approved',
      icon: CheckCircle2,
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    }
  if (status === 'rejected')
    return {
      labelKey: 'status_rejected',
      icon: XCircle,
      className: 'border-red-500/25 bg-red-500/10 text-red-300',
    }
  return {
    labelKey: 'status_pending',
    icon: Clock,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  }
}

export default function MyPlacardsList({ placards }: { placards: MyPlacardCard[] }) {
  const { t } = useLanguage()

  if (placards.length === 0) {
    return (
      <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <ImagePlus className="mx-auto h-8 w-8 text-white/20" />
        <p className="mt-4 font-semibold text-white">{t('my_placards_empty_title')}</p>
        <p className="mt-1 text-sm text-white/50">{t('my_placards_empty_sub')}</p>
        <Link
          href="/pankartat"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flame-400"
        >
          {t('my_placards_upload')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {placards.map((p) => {
        const style = statusStyle(p.status)
        const StatusIcon = style.icon
        return (
          <div
            key={p.id}
            className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <Image
                src={p.imageUrl}
                alt={p.caption ?? 'Placard photo'}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {t(style.labelKey)}
                  </span>
                  {p.city && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/65">
                      {p.city}
                    </span>
                  )}
                </div>
                {p.caption ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/85">
                    {p.caption}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-white/40">{t('my_placards_no_caption')}</p>
                )}
              </div>
              {p.status === 'rejected' && p.adminNote && (
                <p className="mt-2 line-clamp-2 text-[11px] italic text-red-300/80">
                  {t('my_placards_note')} {p.adminNote}
                </p>
              )}
              {p.status === 'approved' && (
                <div className="mt-2 flex items-center gap-3 text-[11px] text-white/55">
                  <span>{p.voteCount} {t('my_placards_likes')}</span>
                  {p.reportCount > 0 && (
                    <span className="text-flame-300">{p.reportCount} {t('my_placards_reports')}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
