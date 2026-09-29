import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi } from './handler.js'

const MAX_BODY_BYTES = 100_000

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  // Vercel pre-parses JSON bodies onto req.body; the Vite dev server doesn't.
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY_BYTES) throw new Error('Body too large')
  }
  return raw ? JSON.parse(raw) : undefined
}

/** Adapts a plain Node request/response pair (Vercel functions & the Vite dev server) to handleApi. */
export async function nodeHandler(req: IncomingMessage & { body?: unknown; originalUrl?: string }, res: ServerResponse) {
  let body: unknown
  try {
    body = req.method === 'POST' ? await readJson(req) : undefined
  } catch {
    body = null
  }
  const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost')
  const token = req.headers['x-admin-token']
  const result = await handleApi({
    method: req.method ?? 'GET',
    query: Object.fromEntries(url.searchParams),
    body,
    token: typeof token === 'string' && token ? token : null,
  })
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(result.body))
}
