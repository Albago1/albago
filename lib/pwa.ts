// PWA install-surface coordination. The install sheet is never a nag popup —
// it only appears after a real engagement moment (a save today; a ticket
// claim once TIX ships). Surfaces signal engagement through this event.

export const PWA_ENGAGEMENT_EVENT = 'albago:pwa-engagement'

export function signalPwaEngagement() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PWA_ENGAGEMENT_EVENT))
}

// PushManager.subscribe wants the VAPID public key as a BufferSource.
export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}
