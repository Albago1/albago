// Minimal ESM resolve hook so scripted tests can import the real project libs.
// Node doesn't read tsconfig, so two things it won't do on its own are done
// here:
//
//   1. '@/...' path aliases (Next maps '@/*' → './*').
//   2. Extensionless RELATIVE imports ('./textModel'). Bundlers resolve these
//      to .ts; Node's type-stripping (≥23) only strips types once a URL is
//      resolved, and refuses to guess an extension. Any lib importing a
//      sibling without one is otherwise unloadable from a script.
//
// Used via: node --import ./scripts/radar-register.mjs scripts/<name>.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** First candidate that is a real FILE on disk, as a file: URL. Directories
 *  are skipped — 'lib/agent' exists but is not a module. */
function firstExistingFile(base, candidates) {
  for (const cand of candidates) {
    const p = path.resolve(base, cand)
    try {
      if (statSync(p).isFile()) return pathToFileURL(p).href
    } catch {
      // Not there — try the next candidate.
    }
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2)
    const url = firstExistingFile(root, [`${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`, rel])
    if (url) return { url, shortCircuit: true }
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parent = context.parentURL
    if (parent?.startsWith('file:')) {
      const base = path.dirname(fileURLToPath(parent))
      const url = firstExistingFile(base, [
        `${specifier}.ts`,
        `${specifier}.tsx`,
        `${specifier}/index.ts`,
      ])
      if (url) return { url, shortCircuit: true }
    }
  }

  return next(specifier, context)
}
