// Seat-sales SQL test (phase 43) — runs docs/seeds/phase-43-seat-sales.sql in an
// in-memory Postgres (PGlite) against stub auth/profiles/events tables, then
// drives the real 37-seat stock through every RPC: seat picking (groups always
// together, no orphan seats), caps, holds lapsing + sweep, the admin/buyer
// state machine, manual sales, refunds, waitlist, cascade delete.
//
// Run (PGlite is not a project dependency — install it without saving):
//   npm i --no-save @electric-sql/pglite@0.3
//   node scripts/seat-sql-test.mjs
//
// Single connection, so it cannot race two transactions; the oversell guard is
// the seat_sales row lock (FOR UPDATE) every mutating RPC takes first.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const SEED = process.argv[2] ?? 'docs/seeds/phase-43-seat-sales.sql'
const db = new PGlite()

const STUBS = `
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.uid', true), '')::uuid $$;
CREATE TABLE profiles (id uuid PRIMARY KEY, role text);
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TABLE events (id uuid PRIMARY KEY, status text, date date, end_date date,
  timezone text, listing_status text);
`

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b1'
const C = '00000000-0000-0000-0000-0000000000c1'
const D = '00000000-0000-0000-0000-0000000000d1'
const EV = '11111111-1111-1111-1111-111111111111'

let failures = 0
function check(name, cond, detail) {
  if (cond) console.log('  ok  ', name)
  else {
    failures++
    console.log('  FAIL', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}
async function as(uid) {
  await db.query(`SELECT set_config('request.uid', $1, false)`, [uid ?? ''])
}
async function rpc(sql, params = []) {
  try {
    const r = await db.query(sql, params)
    return { data: r.rows[0] ? Object.values(r.rows[0])[0] : null }
  } catch (e) {
    return { error: e.message }
  }
}
const reserve = (cat, qty, name = 'Test Buyer', mail = 'buyer@example.com', area = null, block = null) =>
  rpc(`SELECT seat_reserve($1,$2,$3,$4,$5,NULL,NULL,$6,$7)`, [EV, cat, qty, name, mail, area, block])
const pub = () => rpc(`SELECT seat_sale_public($1)`, [EV])
const seatsStr = (res) =>
  res.data.seats.map((s) => `${s.block}/${s.row}/${s.seat}`).join(',')

await db.exec(STUBS)
// Run the seed twice: it must be idempotent.
const seed = readFileSync(SEED, 'utf8')
await db.exec(seed)
await db.exec(seed)
console.log('seed applied twice (idempotent)')

await db.exec(`
INSERT INTO auth.users VALUES ('${ADMIN}','admin@x.com'),('${A}','a@x.com'),('${B}','b@x.com'),('${C}','c@x.com'),('${D}','d@x.com');
INSERT INTO profiles VALUES ('${ADMIN}','admin'),('${A}','user'),('${B}','user'),('${C}','user'),('${D}','user');
INSERT INTO events VALUES ('${EV}','published','2099-11-28',NULL,'Europe/Berlin',NULL);
INSERT INTO seat_sales (event_id, deliver_by) VALUES ('${EV}','2099-11-21');
INSERT INTO seat_categories (event_id, code, label, face_value_cents, price_cents, sort_order) VALUES
  ('${EV}','Cat 4','Innenraum',65000,65000,1),
  ('${EV}','Cat 6','Nord-Tribüne Unterrang',45000,45000,2),
  ('${EV}','Cat 8','Nord-Tribüne Oberrang',25000,25000,3);
`)
// The real 37 seats.
const stock = [
  ['Cat 4', 'Innenraum', '204', '1', [14, 15, 16, 17]],
  ['Cat 8', 'Nord-Tribüne Oberrang', '114', '22', [7, 8, 9, 10, 11, 12, 13]],
  ['Cat 8', 'Nord-Tribüne Oberrang', '114', '23', [10, 11, 12]],
  ['Cat 8', 'Nord-Tribüne Oberrang', '115', '20', [4, 5]],
  ['Cat 8', 'Nord-Tribüne Oberrang', '125', '20', [1, 2, 3, 4, 5, 15, 16, 17]],
  ['Cat 6', 'Nord-Tribüne Unterrang', '12', '18', [14, 15, 16, 17]],
  ['Cat 6', 'Nord-Tribüne Unterrang', '18', '17', [5, 6]],
  ['Cat 6', 'Nord-Tribüne Unterrang', '20 A', '9', [7, 8, 9, 10]],
  ['Cat 6', 'Nord-Tribüne Unterrang', '20 B', '10', [7, 8, 9]],
]
for (const [cat, area, block, row, seats] of stock) {
  for (const n of seats) {
    await db.query(
      `INSERT INTO seat_stock (event_id, category, area, block, row_label, seat_number) VALUES ($1,$2,$3,$4,$5,$6)`,
      [EV, cat, area, block, row, n],
    )
  }
}
const total = (await db.query(`SELECT count(*)::int n FROM seat_stock`)).rows[0].n
check('37 seats loaded', total === 37, total)

console.log('— visibility')
await as(null)
check('draft hidden from anon', (await pub()).data === null)
await as(A)
check('draft hidden from user', (await pub()).data === null)
check('user cannot reserve in draft', (await reserve('Cat 8', 2)).error === 'sales_closed')
await as(ADMIN)
let p = (await pub()).data
check('admin sees draft', p?.mode === 'draft')
const cat = (code) => p.categories.find((c) => c.code === code)
check('Cat 4: 4 free, 4 together', cat('Cat 4').available === 4 && cat('Cat 4').max_together === 4, cat('Cat 4'))
check('Cat 6: 13 free, 4 together', cat('Cat 6').available === 13 && cat('Cat 6').max_together === 4, cat('Cat 6'))
check('Cat 8: 20 free, 7 together', cat('Cat 8').available === 20 && cat('Cat 8').max_together === 7, cat('Cat 8'))
check('map: 8 blocks on sale', p.blocks.length === 8, p.blocks)
check('map: 10 free runs', p.runs.length === 10, p.runs.length)
check('map: run 114/22 starts at 7, 7 long', p.runs.some((r) => r.block === '114' && r.row === '22' && r.first === 7 && r.len === 7), p.runs)

const adminTest = await reserve('Cat 4', 1, 'Admin Test', 'admin@x.com')
check('admin can test-reserve in draft', !!adminTest.data?.reference, adminTest)
await rpc(`SELECT seat_admin_update($1,'cancel',NULL,NULL,NULL,NULL)`, [adminTest.data.id])

await db.exec(`UPDATE seat_sales SET mode = 'live'`)

console.log('— seat picking (together, no orphans)')
await as(A)
let r = await reserve('Cat 8', 2)
check('pair → exact-fit pair 115/20/4-5', r.data && seatsStr(r) === '115/20/4,115/20/5', r)
const resA = r.data
await as(B)
r = await reserve('Cat 8', 3)
check('trio → exact-fit trio 114/23/10-12', r.data && seatsStr(r) === '114/23/10,114/23/11,114/23/12', r)
const resB = r.data
check('reference format', /^SEAT-[A-HJ-KM-NP-Z2-9]{6}$/.test(resB.reference), resB.reference)
check('total = 3 × €250', resB.total_cents === 75000, resB.total_cents)
await as(C)
r = await reserve('Cat 8', 1)
check('single → smallest run leaving ≥2 (125/20/15)', r.data && seatsStr(r) === '125/20/15', r)
r = await reserve('Cat 8', 7)
check('cap: 1 + 7 = 8 allowed, 7 together exact (114/22)', r.data && seatsStr(r).startsWith('114/22/7') && r.data.quantity === 7, r)
r = await reserve('Cat 8', 1)
check('cap: 9th seat refused', r.error === 'user_cap_reached', r)

await as(A)
check('Cat 6 group of 5 → not_together', (await reserve('Cat 6', 5)).error === 'not_together')
check('bad email refused', (await reserve('Cat 6', 2, 'Test', 'nope')).error === 'bad_details')
check('qty 0 refused', (await reserve('Cat 6', 0)).error === 'bad_quantity')
check('unknown category', (await reserve('Cat 9', 1)).error === 'category_not_on_sale')
await as(B)
check('Cat 4 ×4', !!(await reserve('Cat 4', 4)).data)
check('Cat 4 now sold out', (await reserve('Cat 4', 1)).error === 'sold_out')
await as(null)
check('anon cannot reserve', (await reserve('Cat 6', 1)).error === 'auth_required')
p = (await pub()).data
check('public Cat 4 shows 0 left', cat('Cat 4').available === 0, cat('Cat 4'))
check('public Cat 8: 7 left (125/20 1-5 + 16-17), max 5', cat('Cat 8').available === 7 && cat('Cat 8').max_together === 5, cat('Cat 8'))

console.log('— buyer + admin state machine')
await as(B)
check('B cannot cancel A’s hold', (await rpc(`SELECT seat_buyer_update($1,'cancel')`, [resA.id])).error === 'reservation_not_found')
await as(A)
check('A cannot confirm before transfer', (await rpc(`SELECT seat_buyer_update($1,'confirm_received')`, [resA.id])).error === 'bad_transition')
check('A cannot mark own paid', (await rpc(`SELECT seat_admin_update($1,'mark_paid',NULL,NULL,NULL,NULL)`, [resA.id])).error === 'forbidden')
await as(ADMIN)
r = await rpc(`SELECT seat_admin_update($1,'mark_paid','bank_transfer','REF1',NULL,NULL)`, [resA.id])
check('admin mark_paid', r.data?.status === 'paid' && r.data.payment_method === 'bank_transfer', r)
check('cannot cancel paid', (await rpc(`SELECT seat_admin_update($1,'cancel',NULL,NULL,NULL,NULL)`, [resA.id])).error === 'bad_transition')
r = await rpc(`SELECT seat_admin_update($1,'transfer_sent',NULL,NULL,'sent via app',NULL)`, [resA.id])
check('transfer_sent + note', r.data?.status === 'transfer_sent' && r.data.admin_note === 'sent via app', r)
await as(A)
r = await rpc(`SELECT seat_buyer_update($1,'confirm_received')`, [resA.id])
check('buyer confirms → delivered', r.data?.status === 'delivered', r)

await as(B)
r = await rpc(`SELECT seat_buyer_update($1,'cancel')`, [resB.id])
check('buyer cancels hold', r.data?.status === 'cancelled', r)
await as(null)
p = (await pub()).data
check('cancelled trio back on sale (Cat 8 = 10, max 5)', cat('Cat 8').available === 10, cat('Cat 8'))

console.log('— expiry')
await as(C)
r = await reserve('Cat 6', 2) // wait — C has 8 already (cap)
check('C capped across categories', r.error === 'user_cap_reached', r)
await as(B)
r = await reserve('Cat 6', 2)
check('B pair Cat 6 → exact 18/17/5-6', r.data && seatsStr(r) === '18/17/5,18/17/6', r)
const resB2 = r.data
await db.exec(`UPDATE seat_reservations SET expires_at = now() - interval '1 minute' WHERE id = '${resB2.id}'`)
await as(null)
p = (await pub()).data
check('lapsed hold counts as free immediately', cat('Cat 6').available === 13, cat('Cat 6'))
await as(ADMIN)
r = await rpc(`SELECT seat_admin_update($1,'extend_hold',NULL,NULL,NULL,NULL)`, [resB2.id])
check('admin can extend a lapsed-but-unswept hold', r.data?.status === 'held' && new Date(r.data.expires_at) > new Date(), r)
await db.exec(`UPDATE seat_reservations SET expires_at = now() - interval '1 minute' WHERE id = '${resB2.id}'`)
await as(A)
r = await reserve('Cat 6', 2)
check('next reservation sweeps + reuses the pair', r.data && seatsStr(r) === '18/17/5,18/17/6', r)
const st = (await db.query(`SELECT status FROM seat_reservations WHERE id = $1`, [resB2.id])).rows[0].status
check('lapsed hold flipped to expired', st === 'expired', st)
await as(ADMIN)
check('mark_paid on expired → hold_expired', (await rpc(`SELECT seat_admin_update($1,'mark_paid',NULL,NULL,NULL,NULL)`, [resB2.id])).error === 'hold_expired')

console.log('— manual sale + refund')
r = await rpc(`SELECT seat_admin_manual_sale($1,'Cat 6',4,'Friend','b@x.com',NULL,NULL,'whatsapp',true,'cash')`, [EV])
check('manual paid sale of 4 together', r.data?.status === 'paid' && r.data.quantity === 4, r)
const manual = r.data
const linked = (await db.query(`SELECT user_id, source FROM seat_reservations WHERE id = $1`, [manual.id])).rows[0]
check('manual sale linked to existing account by email', linked.user_id === B && linked.source === 'manual', linked)
r = await rpc(`SELECT seat_admin_update($1,'refund',NULL,NULL,NULL,false)`, [manual.id])
check('refund keeping seats', r.data?.status === 'refunded', r)
let freeCat6 = (await pub()).data.categories.find((c) => c.code === 'Cat 6').available
check('refunded-kept seats are not on sale', freeCat6 === 7, freeCat6)
r = await rpc(`SELECT seat_admin_update($1,'release_seats',NULL,NULL,NULL,NULL)`, [manual.id])
freeCat6 = (await pub()).data.categories.find((c) => c.code === 'Cat 6').available
check('release_seats puts them back', freeCat6 === 11, freeCat6)

console.log('— withdrawn + price null')
await db.exec(`UPDATE seat_stock SET withdrawn = true WHERE block = '204'`)
await db.exec(`UPDATE seat_categories SET price_cents = NULL WHERE code = 'Cat 6'`)
p = (await pub()).data
check('unpriced category hidden publicly', !p.categories.some((c) => c.code === 'Cat 6'), p.categories)
await db.exec(`UPDATE seat_categories SET price_cents = 45000 WHERE code = 'Cat 6'`)

console.log('— waitlist')
await db.exec(`UPDATE seat_sales SET mode = 'waitlist'`)
await as(null)
r = await rpc(`SELECT seat_join_waitlist($1,'Fan One','Fan@X.com',NULL,'Cat 8',2,'Zürich')`, [EV])
check('anon joins waitlist', r.error === undefined, r)
r = await rpc(`SELECT seat_join_waitlist($1,'Fan One B','fan@x.com',NULL,'Cat 99',3,NULL)`, [EV])
const wl = (await db.query(`SELECT * FROM seat_waitlist`)).rows
check('same email upserts, unknown category nulled, city kept', wl.length === 1 && wl[0].quantity === 3 && wl[0].category === null && wl[0].city === 'Zürich', wl)
await as(A)
check('reserve refused in waitlist mode', (await reserve('Cat 8', 1)).error === 'sales_closed')
await db.exec(`UPDATE seat_sales SET mode = 'closed'`)
check('waitlist refused when closed', (await rpc(`SELECT seat_join_waitlist($1,'X Y','x@y.com',NULL,NULL,1,NULL)`, [EV])).error === 'sales_closed')

console.log('— block chosen on the map')
await db.exec(`UPDATE seat_sales SET mode = 'live'`)
await as(D)
r = await reserve('Cat 6', 2, 'Map Buyer', 'd@x.com', 'Nord-Tribüne Unterrang', '20 A')
check('block 20 A pair → 20 A/9/7-8', r.data && seatsStr(r) === '20 A/9/7,20 A/9/8', r)
r = await reserve('Cat 6', 3, 'Map Buyer', 'd@x.com', 'Nord-Tribüne Unterrang', '20 A')
check('3 more in 20 A (only 2 left) → sold_out', r.error === 'sold_out', r)
r = await reserve('Cat 6', 2, 'Map Buyer', 'd@x.com', 'Nord-Tribüne Unterrang', '20 B')
check('block 20 B pair → 20 B/10/7-8 (leaves 1 only because asked there)', r.data && seatsStr(r) === '20 B/10/7,20 B/10/8', r)
await as(null)
p = (await pub()).data
check('map runs reflect the picks', p.runs.some((x) => x.block === '20 A' && x.first === 9 && x.len === 2), p.runs.filter((x) => x.block.startsWith('20')))

console.log('— cascade delete')
await db.exec(`DELETE FROM events WHERE id = '${EV}'`)
const left = (await db.query(`SELECT (SELECT count(*) FROM seat_stock)+(SELECT count(*) FROM seat_categories)+(SELECT count(*) FROM seat_reservations)+(SELECT count(*) FROM seat_sales) AS n`)).rows[0].n
check('event delete cascades cleanly', Number(left) === 0, left)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
