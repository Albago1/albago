// Minimal ESM resolve hook so the scripted radar test can import the real
// project libs by their '@/...' alias (Next maps '@/*' → './*'). Node doesn't
// read tsconfig paths, so we resolve them here. Type-stripping (Node ≥23)
// handles the .ts extension once the URL is resolved.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2)
    for (const cand of [rel, `${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`]) {
      const p = path.join(root, cand)
      if (existsSync(p)) return { url: pathToFileURL(p).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
