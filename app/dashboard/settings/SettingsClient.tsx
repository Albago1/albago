'use client'

import Link from 'next/link'
import { ArrowLeft, Bell, Check, Mail, Shield, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { GoogleLogo } from '@/components/auth/GoogleButton'
import DeleteAccountButton from '@/components/dashboard/DeleteAccountButton'
import PushDeviceToggle from '@/components/pwa/PushDeviceToggle'
import NotificationPreferencesForm from './NotificationPreferencesForm'
import { ChangeEmailCard, ChangePasswordCard } from './AccountSecurity'

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Bell
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Icon className="h-5 w-5 text-flame-400" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  )
}

export default function SettingsClient({
  email,
  providers,
  initialSavedEventUpdates,
}: {
  email: string
  providers: string[]
  initialSavedEventUpdates: boolean
}) {
  const { t } = useLanguage()
  const hasPassword = providers.includes('email')
  const hasGoogle = providers.includes('google')

  return (
    <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/90"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('settings_back')}
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold">{t('settings_title')}</h1>
          <p className="mt-0.5 text-sm text-white/45">{email}</p>
        </div>

        {/* Account & security */}
        <section className="mt-10">
          <SectionHeader icon={Shield} title={t('settings_account_title')} />
          <div className="mt-5 space-y-4">
            {/* Connected sign-in methods */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white">
                {t('settings_connected_title')}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {hasGoogle && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/80">
                    <GoogleLogo />
                    Google
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </span>
                )}
                {hasPassword && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/80">
                    <Mail className="h-3.5 w-3.5 text-white/60" />
                    {t('settings_connected_email')}
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </span>
                )}
              </div>
            </div>

            <ChangePasswordCard email={email} hasPassword={hasPassword} />
            <ChangeEmailCard email={email} />

            {/* Danger zone */}
            <div className="rounded-3xl border border-red-500/15 bg-red-500/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-red-200">
                    <Trash2 className="h-4 w-4" />
                    {t('settings_danger_title')}
                  </h3>
                  <p className="mt-1 text-xs text-white/55">
                    {t('settings_delete_sub')}
                  </p>
                </div>
                <DeleteAccountButton email={email} />
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mt-12">
          <SectionHeader icon={Bell} title={t('settings_notifications_title')} />
          <div className="mt-5 space-y-4">
            <NotificationPreferencesForm
              initialSavedEventUpdates={initialSavedEventUpdates}
            />
            <PushDeviceToggle />
          </div>
        </section>
      </div>
    </main>
  )
}
