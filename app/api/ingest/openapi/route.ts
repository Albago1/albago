import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/seo/jsonLd'
import { MAX_EVENTS_PER_REQUEST } from '@/lib/ingest/schema'

/**
 * GET /api/ingest/openapi — the Action schema for the ChatGPT Custom GPT.
 *
 * Served from the app rather than pasted as a static file so it can never drift
 * from the deployed host or the live field list: the GPT builder's "Import from
 * URL" re-reads this, and one redeploy updates both sides.
 *
 * Public on purpose — the builder fetches it without credentials, and a schema
 * is not a secret. It documents an endpoint that is useless without the key.
 *
 * Every field description here is also an instruction the model reads at call
 * time, so they carry the rules that matter most: never invent, always send the
 * source URL, and don't bother reasoning about location slugs because AlbaGo
 * resolves the city itself.
 */

export const dynamic = 'force-dynamic'

const READING_PROPERTIES = {
  source_url: {
    type: 'string',
    description:
      'The public page where you found this event. Always send it when one exists — AlbaGo re-reads that page and uses it to verify (and correct) everything else you send. Omit only for an event with no linkable page.',
  },
  image_url: {
    type: 'string',
    description:
      'Direct URL of the poster/photo IMAGE FILE itself (ends in .jpg/.png/.webp/.avif or serves those bytes), not the page it sits on. AlbaGo downloads it and re-hosts it. Leave empty if you have no real image URL — never send a placeholder or a search-result thumbnail.',
  },
  title: { type: 'string', description: "The event's own name, in its own language. Do not translate or embellish." },
  description: {
    type: 'string',
    description:
      "The source's own wording, in the source's own language. Do not rewrite, do not add adjectives, do not translate — AlbaGo translates separately and the original language is data.",
  },
  category: {
    type: 'string',
    enum: ['nightlife', 'music', 'sports', 'culture', 'food', 'civic', ''],
    description: 'Exactly one, or empty if genuinely unclear.',
  },
  is_civic: {
    type: 'boolean',
    description: 'True for protests, marches, commemorations, civic assemblies. These are human-verified at AlbaGo.',
  },
  date: { type: 'string', description: 'ISO YYYY-MM-DD. If the year is genuinely absent from the source, leave empty — never assume.' },
  time: { type: 'string', description: 'Start time, 24h HH:MM. Empty if the source does not state one. Doors-only time is acceptable as the start.' },
  end_time: { type: 'string', description: 'End time, 24h HH:MM. Empty if unstated.' },
  venue_name: {
    type: 'string',
    description:
      'The venue as OpenStreetMap names it. Keep distinguishing numbers ("Millennium 2" is not "Millennium"). Empty if the source names no venue.',
  },
  address: { type: 'string', description: 'Street and number as stated. Empty if unstated.' },
  city: {
    type: 'string',
    description:
      'A real settlement (Tirana, Durrës, Vlorë, Prishtina…). Never a region, coastline, country, or neighbourhood. This is the input AlbaGo resolves against OpenStreetMap.',
  },
  country: { type: 'string', description: 'Country name in English, e.g. "Albania", "Kosovo".' },
  price: { type: 'string', description: "Exactly as printed, including the currency word ('1000 Lekë', 'Falas'). Empty if unstated." },
  language: {
    type: 'string',
    enum: ['en', 'sq', 'de', 'es', 'it', 'fr'],
    description: "The language the title/description are written in — NOT your output language.",
  },
  tags: {
    type: 'array',
    items: { type: 'string' },
    description: 'Up to 5 lowercase single words drawn from the source (genre, scene, occasion).',
  },
  artists: {
    type: 'array',
    items: { type: 'string' },
    description: 'Performer/speaker names as billed, largest billing first.',
  },
  organizer_name: { type: 'string', description: 'Organizer/promoter as named by the source.' },
  organizer_website: { type: 'string', description: "Organizer's own site, if stated." },
  recurrence: {
    type: 'string',
    enum: ['none', 'daily', 'weekly'],
    description: "Only when the source STATES repetition. 'daily' covers a consecutive-day range like 22–24 August.",
  },
  recurrence_until: { type: 'string', description: 'ISO YYYY-MM-DD last day of the series/range.' },
  recurrence_days_of_week: {
    type: 'array',
    items: { type: 'integer' },
    description: 'ISO weekdays 1=Mon..7=Sun, for weekly series only.',
  },
  suggested_location_slug: {
    type: 'string',
    description:
      'Optional. Recorded as evidence and then IGNORED — AlbaGo always resolves the city itself against OpenStreetMap and its own places. Never spend effort getting this right, and never let it influence the city field.',
  },
  notes_for_admin: {
    type: 'string',
    description:
      'Anything a human reviewer should know: what you could not confirm, where the details came from, why you are unsure. Use this instead of guessing a field.',
  },
} as const

/**
 * The host the GPT will actually POST to.
 *
 * Derived from THIS request rather than from SITE_URL, because SITE_URL defaults
 * to the apex domain while the site serves on www — and a cross-host redirect on
 * a POST is exactly where an Action's Authorization header goes missing. The
 * schema therefore always names the same host the builder fetched it from.
 */
function serverUrl(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return SITE_URL
  const proto = request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const schema = {
    openapi: '3.1.0',
    info: {
      title: 'AlbaGo Event Ingest',
      description:
        'Submit events you have found into AlbaGo\'s admin review queue. Nothing you submit is published — a human approves every event. AlbaGo verifies your submission against the source page and resolves the real location itself.',
      version: '1.0.0',
    },
    servers: [{ url: serverUrl(request) }],
    paths: {
      '/api/ingest/events': {
        post: {
          operationId: 'submitEvents',
          summary: 'Submit found events to AlbaGo for review',
          description:
            `Send up to ${MAX_EVENTS_PER_REQUEST} events. Never invent a value: if the source does not state a field, leave it empty and explain in notes_for_admin. The response tells you, per event, the REAL city slug AlbaGo resolved, which fields are still missing, any warnings, and every place your claim disagreed with the source page — read it and report back to the user rather than resubmitting a guess.`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['events'],
                  properties: {
                    verify_source: {
                      type: 'boolean',
                      description:
                        'Default true. AlbaGo re-reads each source_url and the page wins on any conflict. Only set false if you know the pages are unreadable (login-walled or JavaScript-only).',
                    },
                    events: {
                      type: 'array',
                      maxItems: MAX_EVENTS_PER_REQUEST,
                      items: {
                        type: 'object',
                        required: ['title'],
                        properties: READING_PROPERTIES,
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Per-event outcome.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      summary: {
                        type: 'object',
                        properties: {
                          received: { type: 'integer' },
                          imported: { type: 'integer' },
                          duplicate: { type: 'integer' },
                          not_event: { type: 'integer' },
                          invalid: { type: 'integer' },
                          deferred: { type: 'integer' },
                          errors: { type: 'integer' },
                        },
                      },
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            outcome: {
                              type: 'string',
                              enum: [
                                'imported',
                                'duplicate',
                                'not_event',
                                'invalid',
                                'deferred',
                                'error',
                              ],
                              description:
                                'imported = queued for review. duplicate = AlbaGo already has this source. not_event = it did not read as a real single event. invalid = unusable object. deferred = resubmit it. error = storage failure.',
                            },
                            candidate_id: { type: 'string' },
                            review_url: { type: 'string' },
                            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                            missing_fields: { type: 'array', items: { type: 'string' } },
                            warnings: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  code: { type: 'string' },
                                  message: { type: 'string' },
                                },
                              },
                            },
                            resolved: {
                              type: 'object',
                              description:
                                'What AlbaGo actually resolved. Treat city_slug as authoritative and discard your own guess.',
                              properties: {
                                city_slug: { type: 'string' },
                                city_label: { type: 'string' },
                                country: { type: 'string' },
                                city_status: { type: 'string' },
                                venue: {
                                  type: 'object',
                                  properties: {
                                    status: { type: 'string' },
                                    name: { type: 'string' },
                                  },
                                },
                                coordinates: { type: 'string', enum: ['set', 'unknown'] },
                              },
                            },
                            source_check: {
                              type: 'object',
                              properties: {
                                status: {
                                  type: 'string',
                                  enum: ['verified', 'unreadable', 'skipped'],
                                },
                                conflicts: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      field: { type: 'string' },
                                      agent: { type: 'string' },
                                      page: { type: 'string' },
                                      used: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                            image: {
                              type: 'object',
                              properties: {
                                status: {
                                  type: 'string',
                                  enum: ['adopted', 'hotlinked', 'none'],
                                },
                                url: { type: 'string' },
                                reason: { type: 'string' },
                              },
                            },
                            duplicate: {
                              type: 'object',
                              properties: {
                                status: { type: 'string', enum: ['live', 'in_review', 'none'] },
                                existing_title: { type: 'string' },
                                existing_slug: { type: 'string' },
                              },
                            },
                            message: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Malformed body or no events.' },
            '401': { description: 'Missing or wrong API key.' },
            '413': { description: 'Body too large.' },
          },
        },
      },
    },
  }

  return NextResponse.json(schema, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  })
}
