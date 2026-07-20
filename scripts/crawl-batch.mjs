#!/usr/bin/env node
// AlbaGo Crawl (master plan CRAWL-1.7): huge-list batch driver.
//
// Feeds a whole file of domains / URLs through POST /api/admin/crawl, chunk by
// chunk, following each response's `remaining` until the list is exhausted, and
// writes an aggregated results file. The endpoint bounds each call by a time
// budget; this script loops those calls so a list of ANY size runs to
// completion — no "one at a time".
//
// Usage:
//   node scripts/crawl-batch.mjs <file> [options]
//
//   <file>              text file, one domain or URL per line ('#' = comment).
//                       Bare domains (https://venue.al) → site mode (sitemap
//                       discovery); anything with a path → listing mode.
//
// Options:
//   --endpoint <url>    crawl endpoint (default http://localhost:3000/api/admin/crawl)
//   --secret <token>    CRAWL_SECRET bearer (or set env CRAWL_SECRET)
//   --out <file>        results JSON (default crawl-results.json)
//   --live              actually queue finds as pending (default: dry run only)
//   --chunk <n>         inputs per request (default 400; keep ≤ server cap 500)
//
// Example:
//   CRAWL_SECRET=xxth node scripts/crawl-batch.mjs sources.txt \
//     --endpoint https://www.albago.org/api/admin/crawl --out found.json

import { readFile, writeFile } from 'node:fs/promises'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--live') args.live = true
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i]
    else args._.push(a)
  }
  return args
}

/** A line is "site mode" when it's just an origin (no meaningful path). */
function classify(line) {
  let u
  try {
    u = new URL(line)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const bare = u.pathname === '/' || u.pathname === ''
  return { mode: bare ? 'site' : 'listing', url: u.toString() }
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function postCrawl(endpoint, secret, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || !json.ok) {
    throw new Error(`Crawl failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json.report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = args._[0]
  if (!file) {
    console.error('Usage: node scripts/crawl-batch.mjs <file> [--endpoint url] [--secret t] [--out f] [--live] [--chunk n]')
    process.exit(1)
  }

  const endpoint = args.endpoint || 'http://localhost:3000/api/admin/crawl'
  const secret = args.secret || process.env.CRAWL_SECRET || ''
  const out = args.out || 'crawl-results.json'
  const dryRun = !args.live
  const chunkSize = Math.min(Number(args.chunk) || 400, 500)

  const raw = await readFile(file, 'utf8')
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  const inputs = []
  const skipped = []
  for (const line of lines) {
    const c = classify(line)
    if (c) inputs.push(c)
    else skipped.push(line)
  }
  if (skipped.length) console.warn(`Skipped ${skipped.length} unparseable line(s).`)
  if (inputs.length === 0) {
    console.error('No valid domains/URLs found in the file.')
    process.exit(1)
  }

  console.log(
    `Crawling ${inputs.length} input(s) — ${dryRun ? 'DRY RUN (nothing written)' : 'LIVE (queues pending rows)'} — via ${endpoint}`,
  )

  const allItems = []
  const totals = {}
  const groups = chunk(inputs, chunkSize)

  for (let g = 0; g < groups.length; g++) {
    // Seed this chunk's remaining with its site/listing inputs.
    let remaining = {
      siteUrls: groups[g].filter((x) => x.mode === 'site').map((x) => x.url),
      listingUrls: groups[g].filter((x) => x.mode === 'listing').map((x) => x.url),
    }
    let round = 0
    while ((remaining.siteUrls?.length || 0) + (remaining.listingUrls?.length || 0) > 0) {
      round++
      const report = await postCrawl(endpoint, secret, {
        dryRun,
        siteUrls: remaining.siteUrls,
        listingUrls: remaining.listingUrls,
      })
      for (const it of report.items) allItems.push(it)
      for (const [k, v] of Object.entries(report.counts)) totals[k] = (totals[k] || 0) + v
      const done = report.processedInputs
      const left =
        (report.remaining?.siteUrls?.length || 0) + (report.remaining?.listingUrls?.length || 0)
      console.log(
        `  chunk ${g + 1}/${groups.length} round ${round}: processed ${done} input(s), ${report.items.length} event(s) this call, ${left} input(s) left`,
      )
      remaining = report.remaining || { siteUrls: [], listingUrls: [] }
    }
  }

  await writeFile(out, JSON.stringify({ ranAt: new Date().toISOString(), dryRun, totals, items: allItems }, null, 2))

  console.log('\nDone. Outcome totals:')
  for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: ${v}`)
  const worth = allItems.filter((i) => i.outcome === 'would_submit' || i.outcome === 'submitted')
  console.log(`\n${worth.length} event(s) ${dryRun ? 'ready to queue' : 'queued as pending'}. Full results → ${out}`)
}

main().catch((err) => {
  console.error('\nBatch crawl error:', err.message)
  process.exit(1)
})
