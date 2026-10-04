/**
 * Event Intelligence Engine — public API.
 *
 * This file is the ONLY entry point other code may import (`@/engine`).
 * The engine is customer-neutral: it must not import AlbaGo code (app/,
 * components/, lib/, hooks/, types/, integrations/), Next.js, React,
 * `server-only`, or read process.env. Configuration and I/O arrive through
 * ports passed in by the caller (see integrations/albago/ for AlbaGo's).
 *
 * Boundary enforced by eslint.config.mjs and tests/engine/boundary.test.ts.
 * Architecture: docs/engine/phase-0-plan.md, docs/engine/discovery-architecture.md.
 */

export * from './contract'
