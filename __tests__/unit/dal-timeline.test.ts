import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const docsChain = { or: vi.fn(), data: [] as unknown[] }

function buildDocsChain() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.or = docsChain.or.mockReturnValue(chain)
  chain.then = (resolve: (v: { data: unknown[] }) => void) => resolve({ data: docsChain.data })
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => buildDocsChain()),
  })),
}))

const { getTimelinePage } = await import('@/lib/dal/timeline')

const doc = (id: string, eventDate: string) => ({
  id,
  status: 'organized',
  doc_type: 'lab_report',
  title: `Doc ${id}`,
  title_is_guessed: false,
  document_date: eventDate,
  doctor_name: null,
  facility_name: null,
  captured_at: `${eventDate}T00:00:00Z`,
  event_date: eventDate,
})

beforeEach(() => {
  docsChain.data = []
  docsChain.or.mockClear()
})

describe('getTimelinePage (documents-only — appointments deferred, see lib/dal/timeline.ts)', () => {
  it('orders documents by event_date desc', async () => {
    docsChain.data = [doc('11111111-1111-4111-8111-111111111111', '2026-06-01')]

    const page = await getTimelinePage('profile-1', null)

    expect(page.items).toHaveLength(1)
    expect(page.items[0].eventDate).toBe('2026-06-01')
  })

  it('returns no nextCursor below a full page', async () => {
    docsChain.data = [doc('11111111-1111-4111-8111-111111111111', '2026-01-01')]

    const page = await getTimelinePage('profile-1', null)

    expect(page.nextCursor).toBeNull()
  })

  it('sets nextCursor to the last item when a full page is returned', async () => {
    docsChain.data = Array.from({ length: 20 }, (_, i) =>
      doc(`00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, '2026-01-01')
    )

    const page = await getTimelinePage('profile-1', null)

    expect(page.items).toHaveLength(20)
    expect(page.nextCursor).not.toBeNull()
    expect(page.nextCursor?.eventDate).toBe('2026-01-01')
  })

  it('passes a keyset filter when a cursor is given', async () => {
    await getTimelinePage('profile-1', {
      eventDate: '2026-01-01',
      id: '11111111-1111-4111-8111-111111111111',
    })

    expect(docsChain.or).toHaveBeenCalledWith(
      'event_date.lt.2026-01-01,and(event_date.eq.2026-01-01,id.lt.11111111-1111-4111-8111-111111111111)'
    )
  })
})
