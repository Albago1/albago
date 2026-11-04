// Single-seat protection SQL test (phase 46) — runs the phase-43 seed plus
// supabase/migrations/*_seat_protection.sql in an in-memory Postgres (PGlite)
// against the live stock of 4 Nov 2026, and drives the rules through the real
// RPCs: protected / flexible / final phases, overrides, "sold elsewhere",
// holds that lapse, the seller's manual sale, and who may call what.
//
// Run (PGlite is not a project dependency — install it without saving):
//   npm i --no-save @electric-sql/pglite@0.3
//   node scripts/seat-protection-sql-test.mjs
//
// Single connection: it can't race two transactions. Double-selling is
// prevented by the seat_sales row lock (FOR UPDATE) every reserving RPC takes
// first; here we check that a seat already held can't be bought again.

import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'

const SEED = 'docs/seeds/phase-43-seat-sales.sql'
const MIGRATION = `supabase/migrations/${readdirSync('supabase/migrations').find((f) => f.endsWith('_seat_protection.sql') || f === 'seat_protection.sql')}`
const db = new PGlite()

await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.uid', true), '')::uuid $$;
CREATE TABLE profiles (id uuid PRIMARY KEY, role text);
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TABLE events (id uuid PRIMARY KEY, status text, date date, end_date date,
  timezone text, listing_status text);
-- As on Supabase: signed-in sessions can use auth.uid().
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
`)
const seed = readFileSync(SEED, 'utf8')
await db.exec(seed)
const migration = readFileSync(MIGRATION, 'utf8')
await db.exec(migration)
await db.exec(migration) // idempotent
console.log(`seed + ${MIGRATION} applied (migration twice)`)

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const USERS = Array.from({ length: 12 }, (_, i) => `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`)
const EV = '11111111-1111-1111-1111-111111111111'
const OBER = 'Nord-Tribüne Oberrang'
const UNTER = 'Nord-Tribüne Unterrang'

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
let next = 0
// A fresh buyer per purchase, so the per-buyer cap never interferes.
async function buy(seats, area = OBER) {
  await as(USERS[next++ % USERS.length])
  const list = seats.map(([block, row, seat]) => ({ area: block === '12' || block === '18' || block.startsWith('20') ? UNTER : area, block, row, seat }))
  return rpc(`SELECT seat_reserve_seats($1, $2::jsonb, 'Test Buyer', 'buyer@example.com', NULL, NULL)`, [EV, JSON.stringify(list)])
}
async function buyQty(category, quantity) {
  await as(USERS[next++ % USERS.length])
  return rpc(`SELECT seat_reserve($1,$2,$3,'Test Buyer','buyer@example.com',NULL,NULL,NULL,NULL)`, [EV, category, quantity])
}
const pub = async () => {
  await as(null)
  return (await rpc(`SELECT seat_sale_public($1)`, [EV])).data
}
const runOf = (p, block, row, first) => p.runs.find((r) => r.block === block && r.row === row && (first === undefined || r.first === first))
const today = async (plusDays = 0) =>
  (await db.query(`SELECT ((now() AT TIME ZONE 'Europe/Berlin')::date + $1::int)::text AS d`, [plusDays])).rows[0].d
async function phase(flexOffset, finalOffset) {
  await db.query(`UPDATE seat_sales SET flexible_from = $2, final_from = $3 WHERE event_id = $1`, [
    EV,
    flexOffset === null ? null : await today(flexOffset),
    finalOffset === null ? null : await today(finalOffset),
  ])
}

// ---- the live stock -------------------------------------------------------------
await db.exec(`
INSERT INTO auth.users VALUES ('${ADMIN}','admin@x.com');
INSERT INTO profiles VALUES ('${ADMIN}','admin');
INSERT INTO events VALUES ('${EV}','published','2099-11-28',NULL,'Europe/Berlin',NULL);
INSERT INTO seat_sales (event_id, deliver_by, mode, max_per_order) VALUES ('${EV}','2099-11-21','live',8);
INSERT INTO seat_categories (event_id, code, label, face_value_cents, price_cents, sort_order) VALUES
  ('${EV}','Cat 4','Innenraum',3000,65000,1),
  ('${EV}','Cat 6 B12','Unterrang · Block 12',3000,16900,2),
  ('${EV}','Cat 6 B18','Unterrang · Block 18',3000,13900,3),
  ('${EV}','Cat 6 B20B','Unterrang · Block 20 B',3000,13000,4),
  ('${EV}','Cat 6','Nord-Tribüne Unterrang',3000,45000,5),
  ('${EV}','Cat 8','Nord-Tribüne Oberrang',3000,7900,6);
`)
for (const u of USERS) {
  await db.query(`INSERT INTO auth.users VALUES ($1, $2)`, [u, `${u.slice(-4)}@x.com`])
  await db.query(`INSERT INTO profiles VALUES ($1, 'user')`, [u])
}
const stock = [
  ['Cat 4', 'Innenraum', '204', '1', [14, 15, 16, 17], [14, 15, 16, 17]],
  ['Cat 6 B12', UNTER, '12', '18', [14, 15, 16, 17], []],
  ['Cat 6 B18', UNTER, '18', '17', [5, 6], []],
  ['Cat 6', UNTER, '20 A', '9', [7, 8, 9, 10], [7, 8, 9, 10]],
  ['Cat 6 B20B', UNTER, '20 B', '10', [7, 8, 9], []],
  ['Cat 8', OBER, '114', '22', [7, 8, 9, 10, 11, 12, 13], [7]],
  ['Cat 8', OBER, '114', '23', [10, 11, 12], [10, 11, 12]],
  ['Cat 8', OBER, '115', '20', [4, 5], []],
  ['Cat 8', OBER, '125', '20', [1, 2, 3, 4, 5, 15, 16, 17], []],
]
for (const [cat, area, block, row, seats, kept] of stock) {
  for (const n of seats) {
    await db.query(
      `INSERT INTO seat_stock (event_id, category, area, block, row_label, seat_number, withdrawn, withdrawn_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [EV, cat, area, block, row, n, kept.includes(n), kept.includes(n) ? 'kept' : null],
    )
  }
}
await phase(7, 14) // protected today

console.log('— the public sale carries today\'s rules')
let p = await pub()
check('rules: protection on, phase protected', p.rules?.protect === true && p.rules?.phase === 'protected', p.rules)
check('25 seats free in 7 groups', p.runs.reduce((n, r) => n + r.len, 0) === 25 && p.runs.length === 7, p.runs)
check('114 row 22 is one group of 6 (seat 7 kept back)', runOf(p, '114', '22')?.first === 8 && runOf(p, '114', '22')?.len === 6)

console.log('— protected phase: exact seats')
check('20B middle seat refused (would split the group)', (await buy([['20 B', '10', 8]])).error === 'splits_group')
check('20B two of three refused (strands one)', (await buy([['20 B', '10', 7], ['20 B', '10', 8]])).error === 'strands_seat')
check('18: one of the pair refused', (await buy([['18', '17', 5]])).error === 'strands_seat')
check('114: seats 8 and 10 refused (not side by side)', (await buy([['114', '22', 8], ['114', '22', 10]])).error === 'not_together')
check('125: seats 5 and 15 refused (two separate groups)', (await buy([['125', '20', 5], ['125', '20', 15]])).error === 'not_together')
check('12: three of four refused', (await buy([['12', '18', 14], ['12', '18', 15], ['12', '18', 16]])).error === 'strands_seat')
check('12: two middle seats refused (split)', (await buy([['12', '18', 15], ['12', '18', 16]])).error === 'splits_group')
let r = await buy([['20 B', '10', 7]])
check('20B end seat bought', !r.error && r.data?.quantity === 1, r)
r = await buy([['12', '18', 14], ['12', '18', 15]])
check('12: two from the end bought', !r.error && r.data?.quantity === 2, r)
p = await pub()
check('12 now one group of 2 (16–17)', runOf(p, '12', '18')?.first === 16 && runOf(p, '12', '18')?.len === 2)
check('20B now one group of 2 (8–9)', runOf(p, '20 B', '10')?.first === 8 && runOf(p, '20 B', '10')?.len === 2)
check('20B: a single from the remaining pair refused', (await buy([['20 B', '10', 9]])).error === 'strands_seat')
r = await buy([['18', '17', 5], ['18', '17', 6]])
check('18: the pair bought', !r.error && r.data?.quantity === 2, r)
check('a seat already held cannot be bought again', (await buy([['18', '17', 5], ['18', '17', 6]])).error === 'seats_taken')

console.log('— protected phase: by quantity')
r = await buyQty('Cat 8', 2)
check('2 × €79 goes to the exact pair (115)', r.data?.seats?.every((s) => s.block === '115'), r)
r = await buyQty('Cat 8', 3)
check('3 × €79 goes to the exact three (125, 15–17)', r.data?.seats?.map((s) => s.seat).join() === '15,16,17', r)
r = await buyQty('Cat 6 B20B', 1)
check('… 1 of the last 2 in 20B is refused by name', r.error === 'strands_seat', r)

console.log('— sold elsewhere (Viagogo, in person)')
const before = (await db.query(`SELECT count(*)::int n FROM seat_reservations`)).rows[0].n
await db.query(
  `UPDATE seat_stock SET withdrawn = true, withdrawn_reason = 'external', withdrawn_note = 'Viagogo' WHERE event_id = $1 AND block = '125' AND seat_number = 5`,
  [EV],
)
p = await pub()
check('marked seat leaves the public map', !p.seats.some((s) => s.block === '125' && s.seat === 5))
check('125 seats 1–4 now one group of 4', runOf(p, '125', '20', 1)?.len === 4)
check('it can no longer be bought', (await buy([['125', '20', 5]])).error === 'seats_taken')
check('marking created no order', (await db.query(`SELECT count(*)::int n FROM seat_reservations`)).rows[0].n === before)

console.log('— a hold that lapses gives the seats back')
r = await buy([['114', '22', 8], ['114', '22', 9]])
check('114: two from the end held', !r.error, r)
await db.query(`UPDATE seat_reservations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [r.data.id])
p = await pub()
check('expired hold: 114 is a group of 6 again', runOf(p, '114', '22')?.len === 6, runOf(p, '114', '22'))

console.log('— admin overrides')
await db.query(`UPDATE seat_sales SET quantity_overrides = $2::jsonb WHERE event_id = $1`, [
  EV,
  JSON.stringify([{ area: OBER, block: '114', row: '22', from: 8, to: 13, quantities: [2, 4] }]),
])
check('override: 1 seat of 114 refused', (await buy([['114', '22', 8]])).error === 'quantity_not_allowed')
r = await buy([['114', '22', 8], ['114', '22', 9]])
check('override: 2 seats of 114 allowed', !r.error, r)
p = await pub()
check('public rules carry the override', p.rules.overrides?.[0]?.quantities?.join() === '2,4')
await db.query(`UPDATE seat_sales SET quantity_overrides = '[]'::jsonb WHERE event_id = $1`, [EV])

console.log('— flexible phase')
await phase(0, 7)
p = await pub()
check('phase flexible from today (Berlin)', p.rules.phase === 'flexible', p.rules)
// €79 groups left: 114 10–13 (4) and 125 1–4 (4, seat 5 sold elsewhere).
// Put 125 seat 5 back: 125 is 1–5, which takes 3 cleanly (2 left) …
await db.query(`UPDATE seat_stock SET withdrawn = false, withdrawn_reason = NULL WHERE event_id = $1 AND block = '125' AND seat_number = 5`, [EV])
r = await buy([['114', '22', 10], ['114', '22', 11], ['114', '22', 12]])
check('flexible: 3 of 114\'s 4 refused while 125 could take 3 cleanly', r.error === 'strands_seat', r)
// … sell 125 seat 5 elsewhere again: now no €79 group takes 3 cleanly.
await db.query(`UPDATE seat_stock SET withdrawn = true, withdrawn_reason = 'external' WHERE event_id = $1 AND block = '125' AND seat_number = 5`, [EV])
r = await buy([['114', '22', 10], ['114', '22', 11], ['114', '22', 12]])
check('flexible: … and allowed once no group could', !r.error, r)
// 20B: 8–9 left, the only group of its price → a single is now allowed.
r = await buy([['20 B', '10', 8]])
check('flexible: last-resort single from 20B allowed', !r.error, r)
check('flexible: still no middle seats', (await buy([['125', '20', 2]])).error === 'splits_group')

console.log('— final phase')
await phase(-7, 0)
p = await pub()
check('phase final from today (Berlin)', p.rules.phase === 'final', p.rules)
r = await buy([['125', '20', 2]])
check('final: a middle seat is allowed', !r.error, r)
check('final: seats must still sit side by side', (await buy([['125', '20', 1], ['125', '20', 4]])).error === 'not_together')

console.log('— protection off')
await db.query(`UPDATE seat_sales SET protect_singles = false WHERE event_id = $1`, [EV])
p = await pub()
check('phase off when switched off', p.rules.phase === 'off' && p.rules.protect === false, p.rules)
await db.query(`UPDATE seat_sales SET protect_singles = true WHERE event_id = $1`, [EV])

console.log('— the seller\'s manual sale is not restricted')
await phase(7, 14) // protected again
p = await pub()
const g = runOf(p, '12', '18')
check('12 still 16–17', g?.first === 16 && g?.len === 2, g)
await as(ADMIN)
r = await rpc(
  `SELECT seat_admin_manual_sale($1,'Cat 6 B12',1,'Friend','friend@example.com',NULL,NULL,NULL,true,'cash')`,
  [EV],
)
check('admin sells a single from a pair (strands one) — allowed', !r.error && r.data?.quantity === 1, r)
const leak = (await db.query(`SELECT COALESCE(current_setting('albago.seat_rules', true), '') AS v`)).rows[0].v
check('the bypass ends with the manual sale (no leak to the next call)', leak === '', leak)
await as(USERS[0])
r = await buyQty('Cat 8', 1)
check('next buyer is protected again (phase protected)', (await pub()).rules.phase === 'protected' && !r.error, r)

console.log('— who may call what')
const priv = (await db.query(`SELECT
  has_function_privilege('anon', 'seat_phase(uuid)', 'execute') a1,
  has_function_privilege('authenticated', 'seat_phase(uuid)', 'execute') a2,
  has_function_privilege('anon', 'seat_run_allows(uuid,text,text,text,text,int,int,int,text)', 'execute') a3,
  has_function_privilege('authenticated', 'seat_selection_problem(uuid,uuid[])', 'execute') a4,
  has_function_privilege('anon', 'seat_sale_public(uuid)', 'execute') a5`)).rows[0]
check('rule helpers are not callable from outside', !priv.a1 && !priv.a2 && !priv.a3 && !priv.a4, priv)
check('seat_sale_public still public', priv.a5, priv)

console.log('— activity log')
await db.exec(`SET ROLE authenticated`)
await as(ADMIN)
let logOk = true
try {
  await db.query(`INSERT INTO seat_admin_log (event_id, action, detail) VALUES ($1, 'seat_status', '{"seat":"125/20/5","to":"external"}')`, [EV])
} catch (e) {
  logOk = e.message
}
check('admin can write the log', logOk === true, logOk)
await as(USERS[0])
let denied = false
try {
  await db.query(`INSERT INTO seat_admin_log (event_id, action) VALUES ($1, 'x')`, [EV])
} catch {
  denied = true
}
check('a buyer cannot write the log', denied)
check('a buyer cannot read the log', (await db.query(`SELECT count(*)::int n FROM seat_admin_log`)).rows[0].n === 0)
await as(ADMIN)
check('admin reads the log', (await db.query(`SELECT count(*)::int n FROM seat_admin_log`)).rows[0].n === 1)
await db.exec(`RESET ROLE`)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
