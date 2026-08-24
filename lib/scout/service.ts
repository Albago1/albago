import 'server-only'
import { ingestEvents, type IngestSummary, type IngestResultItem } from '@/lib/ingest/service'
import { buildBriefs, type ScoutBrief } from './brief'
import { searchEventsForBrief } from './search'

/**
 * The Scout run (Phase 39): search the web for events, then hand every find to
 * the ingest pipeline that already exists.
 *
 * This is the autonomous version of the ChatGPT bridge. Same destination, same
 * guarantees — each find is verified against its source page, the city is
 * resolved by us, the picture is re-hosted, duplicates collapse, and nothing is
 * published without a human clicking approve. The only difference is who does
 * the asking: the server, on a schedule, instead of a person in a chat window.
 *
 * Sequential and budgeted, for the same reason discovery is: the grounded search
 * and the per-event verification both take real seconds, and a run that dies
 * mid-way is worse than one that stops cleanly and reports what it reached.
 */

const SOFT_BUDGET_MS = 240_000

export type ScoutBriefReport = {
  brief: ScoutBrief
  /** How many events the search proposed before ingest filtering. */
  found: number
  model: string
  summary: IngestSummary | null
  items: IngestResultItem[]
  error?: string
}

export type ScoutReport = {
  ranAt: string
  briefsRequested: number
  briefsProcessed: number
  found: number
  imported: number
  duplicate: number
  notEvent: number
  invalid: number
  errors: number
  reports: ScoutBriefReport[]
  /** Briefs not reached before the budget ran out. */
  remaining?: ScoutBrief[]
}

export type RunScoutOptions = {
  cities?: Array<{ city: string; country: string }>
  days?: number
  deadlineMs?: number
  /** Off only for a dry run; the whole point is that the page overrules the model. */
  verifySource?: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function runScout(opts: RunScoutOptions = {}): Promise<ScoutReport> {
  const briefs = buildBriefs({
    cities: opts.cities,
    days: opts.days,
    citiesEnv: process.env.SCOUT_CITIES,
  })
  const deadline = Date.now() + (opts.deadlineMs ?? SOFT_BUDGET_MS)
  const today = todayIso()

  const report: ScoutReport = {
    ranAt: new Date().toISOString(),
    briefsRequested: briefs.length,
    briefsProcessed: 0,
    found: 0,
    imported: 0,
    duplicate: 0,
    notEvent: 0,
    invalid: 0,
    errors: 0,
    reports: [],
  }

  for (let i = 0; i < briefs.length; i++) {
    // Always run the first brief; after that, stop starting new ones once the
    // budget is spent. Unreached cities come back next run — or immediately,
    // via the returned `remaining` list.
    if (i > 0 && Date.now() > deadline) {
      report.remaining = briefs.slice(i)
      break
    }

    const brief = briefs[i]
    const search = await searchEventsForBrief(brief, today)
    report.briefsProcessed++
    report.found += search.events.length

    if (search.events.length === 0) {
      report.reports.push({
        brief,
        found: 0,
        model: search.model,
        summary: null,
        items: [],
        ...(search.error ? { error: search.error } : {}),
      })
      if (search.error) report.errors++
      continue
    }

    const ingest = await ingestEvents(search.events, {
      verifySource: opts.verifySource !== false,
    })

    report.imported += ingest.summary.imported
    report.duplicate += ingest.summary.duplicate
    report.notEvent += ingest.summary.not_event
    report.invalid += ingest.summary.invalid
    report.errors += ingest.summary.errors

    report.reports.push({
      brief,
      found: search.events.length,
      model: search.model,
      summary: ingest.summary,
      items: ingest.results,
    })
  }

  return report
}
