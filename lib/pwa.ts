// PWA install-surface coordination. The install sheet is never a nag popup —
// it only appears after a real engagement moment (a save today; a ticket
// claim once TIX ships). Surfaces signal engagement through this event.

export const PWA_ENGAGEMENT_EVENT = 'albago:pwa-engagement'

export function signalPwaEngagement() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PWA_ENGAGEMENT_EVENT))
}

// Capacitor injects window.Capacitor into the store-shell webview
// (apps/shell). The website never bundles Capacitor — feature-detect only.
export type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: {
    StatusBar?: {
      setBackgroundColor: (options: { color: string }) => Promise<void>
      setStyle: (options: { style: string }) => Promise<void>
    }
    App?: {
      addListener: (
        event: 'appUrlOpen',
        callback: (data: { url: string }) => void,
      ) => Promise<{ remove: () => void }>
    }
    Haptics?: {
      impact: (options: { style: string }) => Promise<void>
    }
  }
}

export function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor
}

export function isNativeShell(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true
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
