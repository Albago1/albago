/**
 * robots.txt (RFC 9309). The engine reads a site only where its robots.txt
 * allows our agent token. Pure parsing + matching here; fetching is the
 * deployment's (passed in), so the rule holds for every deployment.
 *
 * - Groups: the most specific group whose user-agent matches our token wins
 *   (all groups naming it are merged); otherwise the `*` group; none = allow.
 * - Rules: longest matching path wins; on a tie Allow wins. `*` and `$` work.
 * - Unreachable robots.txt (5xx, network error) = disallow for now;
 *   missing (4xx) = allow everything.
 */

export type RobotsRule = { allow: boolean; path: string }
export type RobotsRules = { groups: Array<{ agents: string[]; rules: RobotsRule[] }> }

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsRules['groups'] = []
  let current: { agents: string[]; rules: RobotsRule[] } | null = null
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false
      if (!current) continue
      // An empty Disallow means "allow everything" — it adds no rule.
      if (value === '') continue
      current.rules.push({ allow: key === 'allow', path: value })
    } else {
      lastWasAgent = false
    }
  }
  return { groups }
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const re = new RegExp(`^${body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}${anchored ? '$' : ''}`)
  return re.test(path)
}

export function robotsAllows(rules: RobotsRules, url: string, agentToken: string): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  const token = agentToken.toLowerCase()
  const named = rules.groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)))
  const groups = named.length ? named : rules.groups.filter((g) => g.agents.includes('*'))
  const path = `${target.pathname}${target.search}` || '/'
  let best: RobotsRule | null = null
  for (const rule of groups.flatMap((g) => g.rules)) {
    if (!patternMatches(rule.path, path)) continue
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule
  }
  return best ? best.allow : true
}

export type RobotsGate = { allows(url: string): Promise<boolean> }

/**
 * Cached per-origin gate. `fetchText` returns the robots.txt response, or
 * null when it could not be fetched at all.
 */
export function createRobotsGate(opts: {
  agentToken: string
  fetchText: (url: string) => Promise<{ status: number; text: string } | null>
  ttlMs?: number
  now?: () => number
}): RobotsGate {
  const ttl = opts.ttlMs ?? 24 * 60 * 60_000
  const now = opts.now ?? Date.now
  const cache = new Map<string, { at: number; rules: RobotsRules | 'allow_all' | 'disallow_all' }>()

  async function rulesFor(origin: string) {
    const hit = cache.get(origin)
    if (hit && now() - hit.at < ttl) return hit.rules
    let rules: RobotsRules | 'allow_all' | 'disallow_all'
    const res = await opts.fetchText(`${origin}/robots.txt`).catch(() => null)
    if (!res) rules = 'disallow_all'
    else if (res.status >= 500) rules = 'disallow_all'
    else if (res.status >= 400) rules = 'allow_all'
    else rules = parseRobots(res.text.slice(0, 500_000))
    cache.set(origin, { at: now(), rules })
    return rules
  }

  return {
    async allows(url) {
      let origin: string
      try {
        origin = new URL(url).origin
      } catch {
        return false
      }
      const rules = await rulesFor(origin)
      if (rules === 'allow_all') return true
      if (rules === 'disallow_all') return false
      return robotsAllows(rules, url, opts.agentToken)
    },
  }
}
