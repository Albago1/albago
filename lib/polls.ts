/**
 * Fan polls ("Who wins?") shown on an event page. Votes are anonymous — one
 * per browser session per poll, and voting again changes the pick. Storage is
 * `poll_votes`, written only by /api/polls/[key].
 */

export type PollOption = {
  /** Stored as the vote's `choice`. */
  key: string
  name: string
  fullName: string
  flag: string
  color: string
  /** e.g. "25-0 · 23 KO" */
  record: string
  role: 'champion' | 'challenger'
  photo?: string
}

export type Poll = {
  key: string
  eventId: string
  /** Voting stops here (fight start); the result stays visible. */
  closesAt: string
  options: PollOption[]
}

export const POLLS: Poll[] = [
  {
    key: 'kabayel-hysa',
    eventId: 'ca279183-362c-41dc-beea-9be8340a55b6',
    closesAt: '2026-11-28T18:00:00+01:00',
    options: [
      {
        key: 'hysa',
        name: 'Hysa',
        fullName: 'Nelson Hysa',
        flag: '🇦🇱',
        color: '#ee1c25',
        record: '25-0 · 23 KO',
        role: 'challenger',
        photo: 'https://queensberry.co.uk/cdn/shop/files/Nelson_Hysa_4.jpg?v=1749635769&width=480',
      },
      {
        key: 'kabayel',
        name: 'Kabayel',
        fullName: 'Agit Kabayel',
        flag: '🇩🇪',
        color: '#3b82f6',
        record: '27-0 · 19 KO',
        role: 'champion',
        photo: 'https://queensberry.co.uk/cdn/shop/files/Agit_Kabayel_2.jpg?v=1749719130&width=480',
      },
    ],
  },
]

export function pollByKey(key: string): Poll | null {
  return POLLS.find((p) => p.key === key) ?? null
}

export function pollForEvent(eventId: string): Poll | null {
  return POLLS.find((p) => p.eventId === eventId) ?? null
}

export function isPollClosed(poll: Poll, now = Date.now()): boolean {
  return now >= Date.parse(poll.closesAt)
}
