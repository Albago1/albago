export type Movement = {
  slug: string
  name: string
  shortName: string
  tagline: string
  description: string
  manifestoPoints: string[]
  startDate: string | null
  flagshipUrl: string | null
}

export const MOVEMENTS: Movement[] = [
  {
    slug: 'albanian-revolution',
    name: 'Albanian Revolution',
    shortName: 'Albanian Revolution',
    tagline: 'A peaceful, worldwide movement.',
    description:
      'A coordinated civic campaign for transparent institutions and a fair future. Tirana, Prishtina, and the diaspora — peaceful, lawful, family-friendly.',
    manifestoPoints: [
      'Open organizing — no closed rooms.',
      'Lawful — coordinated with local authorities wherever required.',
      'Inclusive — every citizen, every voice.',
      'Family-friendly — bring your kids.',
    ],
    startDate: '2026-07-04',
    flagshipUrl: '/events/albanian-revolution',
  },
]

export function getMovementBySlug(slug: string): Movement | null {
  return MOVEMENTS.find((m) => m.slug === slug) ?? null
}
