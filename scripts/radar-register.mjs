// Registers the '@/...' alias resolve hook before the test's module graph
// loads. Used via: node --import ./scripts/radar-register.mjs scripts/radar-test.mjs
import { register } from 'node:module'
register('./_radar-alias-loader.mjs', import.meta.url)
