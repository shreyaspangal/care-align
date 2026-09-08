import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// D-015 / ANTI_PATTERNS #14: this route exists only to keep Upstash's free
// tier from auto-deleting the database after 14 idle days. It must reject
// anyone who isn't Vercel Cron and must not throw if Upstash itself is down.

const setMock = vi.fn()

vi.mock('@/lib/ratelimit', () => ({
  redisClient: { set: setMock },
}))

const { GET } = await import('@/app/api/cron/keepalive/route')

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/cron/keepalive', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/keepalive', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('pings Upstash and succeeds with the correct secret', async () => {
    setMock.mockResolvedValue('OK')
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(setMock).toHaveBeenCalledWith('carealig:keepalive', expect.any(Number))
  })

  it('returns 500 without throwing when Upstash is unreachable', async () => {
    setMock.mockRejectedValue(new Error('fetch failed'))
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(500)
  })
})
