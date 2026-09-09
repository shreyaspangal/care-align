import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const searchDocumentsDalMock = vi.fn()
vi.mock('@/lib/dal/search', () => ({ searchDocuments: searchDocumentsDalMock }))

const { searchDocuments } = await import('@/actions/search')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchDocuments action', () => {
  it('rejects an empty query without calling the DAL', async () => {
    const result = await searchDocuments({ profileId: '11111111-1111-4111-8111-111111111111', query: '  ' })

    expect(result.success).toBe(false)
    expect(searchDocumentsDalMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid profileId without calling the DAL', async () => {
    const result = await searchDocuments({ profileId: 'not-a-uuid', query: 'lipid' })

    expect(result.success).toBe(false)
    expect(searchDocumentsDalMock).not.toHaveBeenCalled()
  })

  it('trims the query before passing it to the DAL', async () => {
    searchDocumentsDalMock.mockResolvedValue([])

    await searchDocuments({ profileId: '11111111-1111-4111-8111-111111111111', query: '  lipid  ' })

    expect(searchDocumentsDalMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'lipid')
  })

  it('returns the DAL results on success', async () => {
    const items = [{ id: 'doc-1' }]
    searchDocumentsDalMock.mockResolvedValue(items)

    const result = await searchDocuments({ profileId: '11111111-1111-4111-8111-111111111111', query: 'lipid' })

    expect(result).toEqual({ success: true, items })
  })
})
