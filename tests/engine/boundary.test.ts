import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Commercial-independence acceptance tests 1–2 (docs/engine/phase-0-plan.md):
// engine/ must be movable to another repository and consumable without AlbaGo
// code. Lint enforces the same rule; this test also catches it when lint
// isn't run, and covers dynamic import()/require() strings.
const ENGINE = path.resolve(__dirname, '../../engine')
const FORBIDDEN = [
  /from\s+['"](next|react|react-dom|server-only)(\/[^'"]*)?['"]/,
  /from\s+['"]@\/(app|components|lib|hooks|types|integrations|scripts)\//,
  /from\s+['"](\.\.\/)+(app|components|lib|hooks|types|integrations|scripts)(\/|['"])/,
  /import\(\s*['"](@\/(app|components|lib|hooks|types|integrations|scripts)\/|next|react|server-only)/,
  /require\(\s*['"](@\/(app|components|lib|hooks|types|integrations)\/|next|react|server-only)/,
  /^\s*import\s+['"](next|react|react-dom|server-only|@\/(app|components|lib|hooks|types|integrations)\/)/m,
  /process\.env/,
]

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return engineFiles(full)
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [full] : []
  })
}

describe('engine boundary', () => {
  it('engine/ has its two public entry points', () => {
    expect(fs.existsSync(path.join(ENGINE, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(ENGINE, 'server.ts'))).toBe(true)
  })

  it('the browser-safe entry point (index.ts) never pulls in Node modules', () => {
    const graph = new Set<string>()
    const visit = (file: string) => {
      if (graph.has(file)) return
      graph.add(file)
      const src = fs.readFileSync(file, 'utf8')
      expect(src, `${path.relative(ENGINE, file)} imports a Node module`).not.toMatch(/from\s+['"]node:/)
      for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const base = path.resolve(path.dirname(file), m[1])
        const target = [base + '.ts', path.join(base, 'index.ts')].find((f) => fs.existsSync(f))
        if (target) visit(target)
      }
    }
    visit(path.join(ENGINE, 'index.ts'))
    expect(graph.size).toBeGreaterThan(1)
  })

  it('no engine file imports AlbaGo code, Next.js, React, server-only, or reads process.env', () => {
    const violations: string[] = []
    for (const file of engineFiles(ENGINE)) {
      const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      for (const rule of FORBIDDEN) {
        if (rule.test(source)) violations.push(`${path.relative(ENGINE, file)} — ${rule}`)
      }
    }
    expect(violations).toEqual([])
  })
})
