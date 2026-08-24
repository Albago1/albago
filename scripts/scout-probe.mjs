// Scout diagnostic — run with:
//   node scripts/scout-probe.mjs
//
// Calls the grounded search exactly as lib/scout/search.ts does, and prints the
// RAW result: which model answered, what came back, and the real error if it
// failed. Exists because "found nothing" and "the call blew up" look identical
// from the admin panel, and guessing between them wastes hours.

import { readFileSync } from 'node:fs'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

// Minimal .env.local loader — the app gets these from Vercel, this script doesn't.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {
  console.log('(no .env.local found — relying on the ambient environment)')
}

const models = process.argv[2] ? [process.argv[2]] : ['gemini-flash-latest', 'gemini-flash-lite-latest']
const today = new Date().toISOString().slice(0, 10)

console.log(`key present: ${Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)}`)
console.log(`key prefix : ${(process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '').slice(0, 4)}…`)
console.log(`gateway key: ${Boolean(process.env.AI_GATEWAY_API_KEY)}`)
console.log('')

for (const id of models) {
  console.log(`── ${id} ──────────────────────────────`)

  // 1. Plain call, no tools — proves the key and model work at all.
  try {
    const plain = await generateText({
      model: google(id),
      prompt: 'Reply with the single word: ok',
      maxOutputTokens: 2000,
    })
    console.log(`plain call   : OK → ${JSON.stringify(plain.text.slice(0, 40))}`)
  } catch (err) {
    console.log(`plain call   : FAILED → ${err?.message ?? err}`)
    continue
  }

  // 2. Grounded call — the thing the Scout actually does.
  try {
    const res = await generateText({
      model: google(id),
      system:
        'You search the web and reply ONLY with JSON. No markdown fences, no commentary.',
      prompt: `Today is ${today}. Find up to 3 public events happening in Tirana, Albania in the next 30 days. Reply as {"events":[{"title":"","date":"","venue_name":"","source_url":""}]}`,
      tools: { google_search: google.tools.googleSearch({}) },
      maxOutputTokens: 8000,
    })
    console.log(`grounded call: OK`)
    console.log(`finishReason : ${res.finishReason}`)
    console.log(`text length  : ${res.text.length}`)
    console.log(`text         : ${res.text.slice(0, 900)}`)
  } catch (err) {
    console.log(`grounded call: FAILED → ${err?.message ?? err}`)
    if (err?.cause) console.log(`cause        : ${err.cause?.message ?? err.cause}`)
    if (err?.responseBody) console.log(`body         : ${String(err.responseBody).slice(0, 600)}`)
  }
  console.log('')
}
