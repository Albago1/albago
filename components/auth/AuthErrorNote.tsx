'use client'

import { AlertCircle } from 'lucide-react'

/** The shared error banner — message plus optional action (a link or
 *  button rendered beneath, e.g. "Sign in instead" / "Resend confirmation"). */
export default function AuthErrorNote({
  message,
  children,
}: {
  message: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
      </div>
      {children && <div className="mt-2 pl-6">{children}</div>}
    </div>
  )
}
