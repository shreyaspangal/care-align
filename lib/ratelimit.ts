'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// 10 document uploads per user per hour.
// Protects against accidental loops and API cost spikes.
export const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'carealig:upload',
})

// Exported so app/api/cron/keepalive can touch Upstash directly — the free
// tier deletes an idle database after 14 days of no REST API traffic (D-015).
export const redisClient = redis
