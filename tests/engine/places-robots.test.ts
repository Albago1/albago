import { describe, expect, it } from 'vitest'
import { canonicalLocality } from '@/engine'
import { createRobotsGate, parseRobots, robotsAllows } from '@/engine/server'
import { citySlug } from '@/lib/citySlug'

describe('one key per city', () => {
  it('strips the administrative words geocoders add', () => {
    expect(canonicalLocality('Bashkia Durrës')).toEqual({ name: 'Durrës', country: 'AL' })
    expect(canonicalLocality('Qendër Vlorë')).toEqual({ name: 'Vlorë', country: 'AL' })
    expect(canonicalLocality('Stadtgebiet Bremen')).toEqual({ name: 'Bremen', country: 'DE' })
  })

  it('folds local and Albanian spellings into one English name', () => {
    expect(canonicalLocality('Mynihu')?.name).toBe('Munich')
    expect(canonicalLocality('Frankfurti mbi Main')?.name).toBe('Frankfurt')
    expect(canonicalLocality('City of Westminster')?.name).toBe('London')
    expect(canonicalLocality('Bruxelles - Brussel')?.name).toBe('Brussels')
    expect(canonicalLocality('Athen')?.name).toBe('Athens')
  })

  it('gives AlbaGo the same slug for every spelling', () => {
    expect(['Tiranë', 'Tirane', 'Tirana', 'Bashkia Tiranë'].map(citySlug)).toEqual(['tirana', 'tirana', 'tirana', 'tirana'])
    expect(['München', 'Munchen', 'Mynihu'].map(citySlug)).toEqual(['munich', 'munich', 'munich'])
    expect(citySlug('Wien')).toBe('vienna')
    expect(citySlug('Milano')).toBe('milan')
    expect(citySlug('St. Gallen')).toBe('st-gallen')
    // Unknown places keep their own name, never invented or dropped.
    expect(citySlug('Fushë Kuqe')).toBe('fushe-kuqe')
  })
})

describe('robots.txt', () => {
  const rules = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/events/
Disallow: /*.pdf$

User-agent: BadBot
User-agent: AlbaGoBot
Disallow: /search
`)

  it('uses the group that names us, merged across user-agent lines', () => {
    expect(robotsAllows(rules, 'https://x.al/search?q=koncert', 'AlbaGoBot')).toBe(false)
    // Our own group does not inherit the * rules.
    expect(robotsAllows(rules, 'https://x.al/private/a', 'AlbaGoBot')).toBe(true)
  })

  it('applies longest match, Allow on ties, and wildcards for everyone else', () => {
    expect(robotsAllows(rules, 'https://x.al/private/a', 'OtherBot')).toBe(false)
    expect(robotsAllows(rules, 'https://x.al/private/events/1', 'OtherBot')).toBe(true)
    expect(robotsAllows(rules, 'https://x.al/files/program.pdf', 'OtherBot')).toBe(false)
    expect(robotsAllows(rules, 'https://x.al/files/program.pdf?v=2', 'OtherBot')).toBe(true)
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow:'), 'https://x.al/any', 'AlbaGoBot')).toBe(true)
  })

  it('missing robots.txt allows, unreachable disallows, and answers are cached', async () => {
    let calls = 0
    const responses: Record<string, { status: number; text: string } | null> = {
      'https://open.al/robots.txt': { status: 404, text: '' },
      'https://down.al/robots.txt': { status: 503, text: '' },
      'https://strict.al/robots.txt': { status: 200, text: 'User-agent: *\nDisallow: /' },
      'https://gone.al/robots.txt': null,
    }
    const gate = createRobotsGate({
      agentToken: 'AlbaGoBot',
      fetchText: async (url) => {
        calls++
        return responses[url] ?? null
      },
    })
    expect(await gate.allows('https://open.al/e/1')).toBe(true)
    expect(await gate.allows('https://down.al/e/1')).toBe(false)
    expect(await gate.allows('https://strict.al/e/1')).toBe(false)
    expect(await gate.allows('https://gone.al/e/1')).toBe(false)
    expect(await gate.allows('https://open.al/e/2')).toBe(true)
    expect(calls).toBe(4)
  })
})
