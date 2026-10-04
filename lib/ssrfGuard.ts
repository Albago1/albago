// SSRF guard now lives in the engine (engine/acquire/ssrf.ts); re-exported for existing callers.
export { isPublicHttpUrl, safeFetch, type SafeFetchOptions } from '@/engine/server'
