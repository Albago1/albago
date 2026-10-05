import { describe, expect, it } from 'vitest'
import { hasMobileBottomNav } from '@/lib/mobileNav'

describe('hasMobileBottomNav', () => {
  it('shows the nav on public discovery pages', () => {
    for (const path of ['/', '/events', '/events/some-slug', '/map', '/cities', '/dashboard']) {
      expect(hasMobileBottomNav(path)).toBe(true)
    }
  })

  it('keeps the nav on the public organizer directory and profiles', () => {
    expect(hasMobileBottomNav('/organizers')).toBe(true)
    expect(hasMobileBottomNav('/organizers/some-collective')).toBe(true)
  })

  it('hides the nav on organizer tools, admin and auth flows', () => {
    for (const path of ['/organizer', '/organizer/create', '/admin', '/admin/engine', '/sign-in', '/sign-up', '/onboarding/organizer', '/auth/callback']) {
      expect(hasMobileBottomNav(path)).toBe(false)
    }
  })
})
