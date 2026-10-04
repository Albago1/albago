/**
 * Event Intelligence Engine — public API.
 *
 * Public entry points: `@/engine` (this file — pure, runtime-neutral, safe in
 * the browser) and `@/engine/server` (Node-only I/O and services).
 * The engine is customer-neutral: it must not import AlbaGo code (app/,
 * components/, lib/, hooks/, types/, integrations/), Next.js, React,
 * `server-only`, or read process.env. Configuration and I/O arrive through
 * ports passed in by the caller (see integrations/albago/ for AlbaGo's).
 *
 * Boundary enforced by eslint.config.mjs and tests/engine/boundary.test.ts.
 * Architecture: docs/engine/phase-0-plan.md, docs/engine/discovery-architecture.md.
 */

export * from './contract'
export * from './core/text'
export * from './core/match'
export * from './extract/page'
export * from './extract/extraction'
export * from './extract/jsonld'
export * from './extract/modelJson'
export type * from './ports'
export * from './core/normalize'
export * from './core/places'
export * from './core/candidate'
export * from './core/reconcile'
export * from './core/relevance'
