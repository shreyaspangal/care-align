import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const state = {
  documentsDirect: [] as unknown[],
  documentsByIds: [] as unknown[],
  explanations: [] as unknown[],
}

function buildChain(data: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.textSearch = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: { data: unknown[] }) => void) => resolve({ data })
  return chain
}

let documentsCallCount = 0
const fromMock = vi.fn((table: string) => {
  if (table === 'documents') {
    documentsCallCount += 1
    return buildChain(documentsCallCount === 1 ? state.documentsDirect : state.documentsByIds)
  }
  if (table === 'document_explanations') {
    return buildChain(state.explanations)
  }
  throw new Error(`unexpected table ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}))

const { searchDocuments } = await import('@/lib/dal/search')

const documentRow = (id: string, eventDate: string, overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
})

beforeEach(() => {
  documentsCallCount = 0
  state.documentsDirect = []
  state.documentsByIds = []
  state.explanations = []
  fromMock.mockClear()
})

describe('searchDocuments', () => {
  it('returns documents matched directly by title/doctor/facility', async () => {
    state.documentsDirect = [documentRow('doc-1', '2026-06-01')]

    const results = await searchDocuments('profile-1', 'lipid')

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('doc-1')
  })

  it('includes documents only matched via their explanation, fetched by id', async () => {
    state.documentsDirect = []
    state.explanations = [{ document_id: 'doc-2', documents: { profile_id: 'profile-1' } }]
    state.documentsByIds = [documentRow('doc-2', '2026-05-01')]

    const results = await searchDocuments('profile-1', 'fever')

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('doc-2')
  })

  it('does not fetch by id again for a document already matched directly', async () => {
    state.documentsDirect = [documentRow('doc-1', '2026-06-01')]
    state.explanations = [{ document_id: 'doc-1', documents: { profile_id: 'profile-1' } }]

    const results = await searchDocuments('profile-1', 'lipid')

    expect(results).toHaveLength(1)
    // only the direct-search 'documents' call happened — no second lookup by id
    expect(documentsCallCount).toBe(1)
  })

  it('merges and sorts direct and explanation-matched results by event_date desc', async () => {
    state.documentsDirect = [documentRow('doc-newer', '2026-06-01')]
    state.explanations = [{ document_id: 'doc-older', documents: { profile_id: 'profile-1' } }]
    state.documentsByIds = [documentRow('doc-older', '2026-01-01')]

    const results = await searchDocuments('profile-1', 'report')

    expect(results.map((r) => r.id)).toEqual(['doc-newer', 'doc-older'])
  })

  it('returns an empty array when nothing matches', async () => {
    const results = await searchDocuments('profile-1', 'nonexistent')

    expect(results).toEqual([])
  })
})
