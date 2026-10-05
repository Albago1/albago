// Routes where the phone bottom nav is suppressed — admin / organizer / auth
// surfaces are deeper workflows and the bar would distract from the task.
// /dashboard stays visible: it is the Profile tab's destination.
const SUPPRESS_PREFIXES = ['/admin', '/organizer', '/onboarding', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/auth']

/** Whether the phone bottom nav shows on this route. Matches whole path
 *  segments, so the public /organizers pages keep the nav while the
 *  /organizer tools hide it. */
export function hasMobileBottomNav(pathname: string) {
  return !SUPPRESS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
