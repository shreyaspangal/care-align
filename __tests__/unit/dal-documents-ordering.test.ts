import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const orderMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

const rows = [
  { id: 'no-date-old', status: 'organized', doc_type: 'lab_report', title: null, title_is_guessed: false, document_date: null, doctor_name: null, facility_name: null, captured_at: '2026-01-01T00:00:00Z', event_date: '2026-01-01' },
]

function buildChain() {
  const chain: Record<string, unknown> = {}
  chain.select = selectMock.mockReturnValue(chain)
  chain.eq = eqMock.mockReturnValue(chain)
  chain.order = orderMock.mockReturnValue(chain)
  chain.then = (resolve: (v: { data: typeof rows }) => void) => resolve({ data: rows })
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: fromMock.mockReturnValue(buildChain()),
  })),
}))

const { getDocuments } = await import('@/lib/dal/documents')

describe('getDocuments ordering', () => {
  it('orders by the event_date generated column, id as tiebreaker', async () => {
    await getDocuments('11111111-1111-4111-8111-111111111111')

    expect(orderMock).toHaveBeenNthCalledWith(1, 'event_date', { ascending: false })
    expect(orderMock).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
  })

  it('maps rows with a null document_date to "unknown" honestly (Rule 2), independent of event_date', async () => {
    const result = await getDocuments('11111111-1111-4111-8111-111111111111')
    expect(result[0].documentDate).toBeNull()
    expect(result[0].eventDate).toBe('2026-01-01')
  })
})
