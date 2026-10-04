import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The pre-vitest self-test scripts (scripts/*-test.mjs) pin the behaviour of
// the Radar / ingest / Scout / Compose pipeline that the Event Engine will
// absorb. They run unchanged in their default mode (no network, no AI quota);
// any FAIL line — or a crash — fails this suite, so they act as regression
// gates while that code moves into engine/.
const ROOT = path.resolve(__dirname, '../..')
const SCRIPTS = ['radar', 'scout', 'ingest', 'agent']

describe('legacy pipeline self-tests', () => {
  for (const name of SCRIPTS) {
    it(`${name}-test.mjs passes every check`, () => {
      const output = execFileSync(
        process.execPath,
        ['--import', './scripts/radar-register.mjs', `scripts/${name}-test.mjs`],
        { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
      )
      const failures = output.split('\n').filter((line) => line.startsWith('FAIL'))
      expect(failures).toEqual([])
      expect(output).toMatch(/^PASS/m)
    })
  }
})
