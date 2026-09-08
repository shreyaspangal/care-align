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
  const originalHealthcheckUrl = process.env.HEALTHCHECKS_PING_URL
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    process.env.HEALTHCHECKS_PING_URL = 'https://hc-ping.com/test-uuid'
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret
    process.env.HEALTHCHECKS_PING_URL = originalHealthcheckUrl
    vi.unstubAllGlobals()
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(setMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('pings Upstash and the healthcheck success URL with the correct secret', async () => {
    setMock.mockResolvedValue('OK')
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(setMock).toHaveBeenCalledWith('carealig:keepalive', expect.any(Number))
    expect(fetchMock).toHaveBeenCalledWith('https://hc-ping.com/test-uuid')
  })

  it('returns 500 and pings the healthcheck /fail URL when Upstash is unreachable', async () => {
    setMock.mockRejectedValue(new Error('fetch failed'))
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledWith('https://hc-ping.com/test-uuid/fail')
  })

  it('still succeeds if HEALTHCHECKS_PING_URL is unset (monitoring is optional)', async () => {
    delete process.env.HEALTHCHECKS_PING_URL
    setMock.mockResolvedValue('OK')
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still returns ok when the healthcheck ping itself fails', async () => {
    setMock.mockResolvedValue('OK')
    fetchMock.mockRejectedValue(new Error('healthchecks.io unreachable'))
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
  })

  // fetch() does not throw on a non-2xx response — a real bug found live
  // (2026-09-08): a silent ping failure could look identical to success from
  // this route's own perspective. Must be checked explicitly.
  it('still returns ok, but the ping is checked, when healthchecks returns a non-OK status', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setMock.mockResolvedValue('OK')
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    const res = await GET(makeRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
