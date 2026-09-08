import { NextResponse } from 'next/server'
import { redisClient } from '@/lib/ratelimit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:cron:keepalive')

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
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('keepalive', 'Upstash ping failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
