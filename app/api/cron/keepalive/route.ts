import { NextResponse } from 'next/server'
import { redisClient } from '@/lib/ratelimit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:cron:keepalive')

// Ping healthchecks.io so a missed/failed run raises a real alert — Vercel's
// own Alerts product is Pro-only (this project is on Hobby), and a dead-man's-
// switch monitor works identically regardless of plan tier. Best-effort: a
// monitoring-service outage must never fail the keepalive itself.
async function pingHealthcheck(suffix: '' | '/fail') {
  const url = process.env.HEALTHCHECKS_PING_URL
  if (!url) return
  try {
    await fetch(`${url}${suffix}`)
  } catch {
    // Monitoring is best-effort — swallow, the Upstash write already succeeded/failed on its own merits.
  }
}

// Upstash's free tier deletes a database after 14 days with no REST API
// traffic — this is the only thing standing between us and losing the
// upload rate limiter's backing store again (D-015, ANTI_PATTERNS #14).
// Vercel Cron (vercel.json) sends `Authorization: Bearer $CRON_SECRET`
// automatically when CRON_SECRET is set on the project.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await redisClient.set('carealig:keepalive', Date.now())
    await pingHealthcheck('')
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('keepalive', 'Upstash ping failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    await pingHealthcheck('/fail')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
