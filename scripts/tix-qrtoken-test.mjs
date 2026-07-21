// QR token self-test — run with: node scripts/tix-qrtoken-test.mjs
// (Node ≥23 strips TS types natively, so it imports the real lib.)
process.env.TICKET_QR_SECRET ??= 'test-secret-test-secret-test-secret-42'

const { signTicketToken, verifyTicketToken, deriveEventKey } = await import(
  '../lib/tickets/qrToken.ts'
)

const eventA = '6ed264f4-6d81-4ac6-9c47-3c6af8271cf6'
const eventB = '00000000-1111-2222-3333-444444444444'
const ticket = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

let failed = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failed++
}

const token = signTicketToken(eventA, ticket, 1)
check('token has ALBGO1 prefix + 4 parts', token.startsWith('ALBGO1.') && token.split('.').length === 4)

const kA = deriveEventKey(eventA)
const kB = deriveEventKey(eventB)

const good = verifyTicketToken(token, kA)
check('roundtrip verifies', good.ok && good.ticketId === ticket && good.qrVersion === 1)

check('other event key rejects (wrong door)', verifyTicketToken(token, kB).ok === false)

const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA')
check('tampered signature rejects', verifyTicketToken(tampered, kA).ok === false)

const [p, id, , sig] = token.split('.')
check('bumped version rejects old sig', verifyTicketToken(`${p}.${id}.2.${sig}`, kA).ok === false)
check('version-2 token verifies fresh', verifyTicketToken(signTicketToken(eventA, ticket, 2), kA).ok === true)

check('garbage is malformed', verifyTicketToken('hello world', kA).ok === false)
check('empty is malformed', verifyTicketToken('', kA).ok === false)

process.exit(failed === 0 ? 0 : 1)
