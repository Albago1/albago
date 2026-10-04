// Manual discovery run (development) — run with:
//   node --import ./scripts/radar-register.mjs scripts/engine-discover.mjs
//
// Runs AlbaGo's "Tirana, next 14 days" goal through the Event Engine's AI
// research lane. Writes ONLY to the engine tables (observations, occurrences
// awaiting review, a run record). Nothing is published to AlbaGo.
// Costs: up to the goal's budget of Tavily searches and free-tier Gemini calls.

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { albagoEngine } = await import('../integrations/albago/wiring.ts')
const { tiranaNext14Days, BLOCKED_HOSTS } = await import('../integrations/albago/goals.ts')

const engine = albagoEngine()
const goal = tiranaNext14Days()
if (process.env.ENGINE_RUN_MINUTES) goal.budget.max_minutes = Number(process.env.ENGINE_RUN_MINUTES)
console.log(`Running: ${goal.label}`)
console.log(`Budget: ${goal.budget.max_searches} searches, ${goal.budget.max_fetches} page reads, ${goal.budget.max_minutes} min\n`)

const started = Date.now()
const report = await engine.discover(goal, { triggeredBy: null, blockedHosts: BLOCKED_HOSTS })

console.log(`Run ${report.runId} — ${report.status} in ${Math.round((Date.now() - started) / 1000)}s`)
console.log(`Window: ${report.window.from} → ${report.window.to}`)
console.log('Stats:', JSON.stringify(report.stats))
if (report.error) console.log('Error:', report.error)
console.log('\nSubmitted pages:')
for (const o of report.outcomes) {
  console.log(`  [${o.outcome}] ${o.start_date ?? '—'}  ${o.title ?? '(no title)'}\n      ${o.url}${o.issues.length ? `\n      issues: ${o.issues.join(', ')}` : ''}`)
}
if (report.proposedSources.length) console.log('\nProposed sources:\n  ' + report.proposedSources.join('\n  '))
console.log('\nAgent summary:\n' + report.summary)
