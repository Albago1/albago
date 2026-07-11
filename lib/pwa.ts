// PWA install-surface coordination. The install sheet is never a nag popup —
// it only appears after a real engagement moment (a save today; a ticket
// claim once TIX ships). Surfaces signal engagement through this event.

export const PWA_ENGAGEMENT_EVENT = 'albago:pwa-engagement'

export function signalPwaEngagement() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PWA_ENGAGEMENT_EVENT))
}
