import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@supabase/supabase-js'
import { createEngine, createRobotsGate, safeFetch, type Engine } from '@/engine/server'
import { supabaseEngineStore } from './store'
import { tavilySearch } from './search'

/**
 * Builds the engine with AlbaGo's deployment choices: Supabase (schema
 * `engine`, service role), Gemini via the AI SDK, Tavily search, and the
 * engine's own SSRF-safe fetcher. Server-side only — callers must be server
 * code behind an admin guard. Reads env here so the engine never does.
 */

// Honest identification: sites can see who reads them and allow or refuse
// AlbaGoBot in their robots.txt, which the fetcher below respects.
const AGENT_TOKEN = 'AlbaGoBot'
const HEADERS = {
  'User-Agent': `Mozilla/5.0 (compatible; ${AGENT_TOKEN}/1.0; +https://www.albago.org)`,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sq,en;q=0.9,de;q=0.8,it;q=0.7',
}

// Per server instance; robots.txt answers are cached for a day.
const robots = createRobotsGate({
  agentToken: AGENT_TOKEN,
  async fetchText(url) {
    try {
      const res = await safeFetch(url, { headers: HEADERS, timeoutMs: 6000 })
      return { status: res.status, text: res.ok ? await res.text() : '' }
    } catch {
      return null
    }
  },
})

/**
 * Free-tier pacing for Gemini: space requests per model and, on a 429, wait
 * the delay Google asks for ("retry in 52s") and try again — so a run slows
 * down instead of failing. Deployment concern, not engine logic.
 */
function pacedFetch(minIntervalMs: number): typeof fetch {
  const lastCall = new Map<string, number>()
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const model = url.match(/models\/([^:/?]+)/)?.[1] ?? 'default'
    for (let attempt = 0; ; attempt++) {
      const wait = (lastCall.get(model) ?? 0) + minIntervalMs - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      lastCall.set(model, Date.now())
      const res = await fetch(input, init)
      if (res.status !== 429 || attempt >= 3) return res
      const body = await res.clone().text()
      const seconds = Number(body.match(/retry in ([\d.]+)s/i)?.[1] ?? body.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 30)
      await new Promise((r) => setTimeout(r, Math.min(Math.ceil(seconds) + 1, 65) * 1000))
    }
  }
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export function albagoEngine(): Engine {
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const agentModel = process.env.ENGINE_AGENT_MODEL || 'gemini-flash-lite-latest'
  const extractModel = process.env.ENGINE_EXTRACT_MODEL || 'gemini-flash-lite-latest'
  const google = createGoogleGenerativeAI({
    apiKey: required('GOOGLE_GENERATIVE_AI_API_KEY'),
    fetch: pacedFetch(Number(process.env.ENGINE_AI_MIN_INTERVAL_MS || 7000)),
  })
  return createEngine({
    store: supabaseEngineStore(client),
    reasoner: { id: `google/${agentModel}+${extractModel}`, agent: google(agentModel), extractor: google(extractModel) },
    // Lazy: reviewing must work without a search key; only discovery needs it.
    search: {
      id: 'tavily',
      search: (query, opts) => tavilySearch(required('TAVILY_API_KEY')).search(query, opts),
    },
    fetcher: {
      async fetchHtml(url) {
        try {
          if (!(await robots.allows(url))) {
            console.info('[engine] robots.txt disallows', new URL(url).host)
            return null
          }
          const res = await safeFetch(url, { headers: HEADERS, timeoutMs: 10_000 })
          const contentType = res.headers.get('content-type') ?? ''
          if (!res.ok || !/html|xml/.test(contentType)) return null
          const html = (await res.text()).slice(0, 800_000)
          return { url, finalUrl: res.url || url, status: res.status, contentType, html }
        } catch {
          return null
        }
      },
    },
  })
}
