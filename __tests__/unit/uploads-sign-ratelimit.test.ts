import { describe, it, expect, vi, beforeEach } from 'vitest'

// ANTI_PATTERNS #13: a rate-limit *hit* (real domain rejection) must fail
// closed; an infra failure reaching Upstash itself must fail open so a
// rate-limiter outage never blocks capture (Rule 3, capture is sacred).

const limitMock = vi.fn()
const getUserMock = vi.fn()
const createSignedUploadUrlMock = vi.fn()
const getProfileMock = vi.fn()

vi.mock('@/lib/ratelimit', () => ({
  uploadRatelimit: { limit: limitMock },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    storage: { from: () => ({ createSignedUploadUrl: createSignedUploadUrlMock }) },
  })),
}))

vi.mock('@/lib/dal/profiles', () => ({
  getProfile: getProfileMock,
}))

const { POST } = await import('@/app/api/uploads/sign/route')

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validBody = { profileId: '11111111-1111-4111-8111-111111111111', mimeType: 'image/jpeg' }

describe('POST /api/uploads/sign — rate limiter fail-open behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    getProfileMock.mockResolvedValue({ id: validBody.profileId })
    createSignedUploadUrlMock.mockResolvedValue({
      data: { path: 'p', token: 't', signedUrl: 'https://example.com' },
      error: null,
    })
  })

  it('fails closed (429) on an actual rate-limit hit', async () => {
    limitMock.mockResolvedValue({ success: false })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled()
  })

  it('proceeds normally when under the limit', async () => {
    limitMock.mockResolvedValue({ success: true })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(createSignedUploadUrlMock).toHaveBeenCalled()
  })

  it('fails open when the rate limiter itself is unreachable', async () => {
    limitMock.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(createSignedUploadUrlMock).toHaveBeenCalled()
  })
})
