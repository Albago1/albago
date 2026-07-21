// Concurrency claim test — proves overselling is impossible (phase 33 Stage A DoD).
//
// Setup (once, after running docs/seeds/phase-33-ticketing.sql):
//   1. Create a tier with capacity 1 on a published NON-civic test event
//      (SQL: INSERT INTO ticket_tiers (event_id, name, capacity) VALUES ('<event-uuid>', 'Test', 1);)
//   2. Run with two test accounts:
//      TIX_TIER_ID=<tier-uuid> TIX_EMAIL1=a@x.com TIX_PASS1=... TIX_EMAIL2=b@x.com TIX_PASS2=... \
//        node scripts/tix-concurrency-test.mjs
//
// Expected: exactly ONE of the two simultaneous claims succeeds; the other
// gets sold_out (or user_cap_reached on re-runs). Any other outcome = bug.

import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const { TIX_TIER_ID, TIX_EMAIL1, TIX_PASS1, TIX_EMAIL2, TIX_PASS2 } = process.env

if (!URL || !ANON || !TIX_TIER_ID || !TIX_EMAIL1 || !TIX_PASS1 || !TIX_EMAIL2 || !TIX_PASS2) {
  console.error('Missing env. See header comment for usage.')
  process.exit(1)
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(json)}`)
  return json.access_token
}

async function claim(jwt) {
  const res = await fetch(`${URL}/rest/v1/rpc/claim_free_tickets`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tier_id: TIX_TIER_ID, p_quantity: 1 }),
  })
  const body = await res.json()
  return res.ok ? { ok: true, body } : { ok: false, code: body?.message ?? JSON.stringify(body) }
}

const [jwt1, jwt2] = await Promise.all([signIn(TIX_EMAIL1, TIX_PASS1), signIn(TIX_EMAIL2, TIX_PASS2)])

// Fire both claims in the same instant.
const [r1, r2] = await Promise.all([claim(jwt1), claim(jwt2)])
console.log('account 1:', r1.ok ? `OK ${JSON.stringify(r1.body.tickets)}` : `REJECTED (${r1.code})`)
console.log('account 2:', r2.ok ? `OK ${JSON.stringify(r2.body.tickets)}` : `REJECTED (${r2.code})`)

const successes = [r1, r2].filter((r) => r.ok).length
if (successes === 1) {
  console.log('\nRESULT: PASS — exactly one claim won the last ticket. No oversell.')
} else if (successes === 0) {
  console.log('\nRESULT: check setup — both rejected (tier already sold out from a previous run?)')
  process.exit(1)
} else {
  console.log('\nRESULT: FAIL — both claims succeeded on capacity 1. OVERSELL BUG.')
  process.exit(1)
}
