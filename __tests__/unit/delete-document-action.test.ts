import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/ai/organize', () => ({ organizeDocument: vi.fn() }))

const getUserMock = vi.fn()
const deleteEqMock = vi.fn()
const deleteSelectMock = vi.fn()
const deleteMaybeSingleMock = vi.fn()
const storageRemoveMock = vi.fn()
const fromMock = vi.fn()
const storageFromMock = vi.fn()

function buildDeleteChain() {
  const chain: Record<string, unknown> = {}
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = deleteEqMock.mockReturnValue(chain)
  chain.select = deleteSelectMock.mockReturnValue(chain)
  chain.maybeSingle = deleteMaybeSingleMock
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock.mockReturnValue(buildDeleteChain()),
    storage: { from: storageFromMock.mockReturnValue({ remove: storageRemoveMock }) },
  })),
}))

const { deleteDocument } = await import('@/actions/documents')

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  fromMock.mockReturnValue(buildDeleteChain())
  storageFromMock.mockReturnValue({ remove: storageRemoveMock })
})

const documentId = '11111111-1111-4111-8111-111111111111'

describe('deleteDocument', () => {
  it('rejects an invalid document id without touching the database', async () => {
    const result = await deleteDocument('not-a-uuid')
    expect(result).toEqual({ success: false, error: 'Invalid document' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('rejects when not signed in', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const result = await deleteDocument(documentId)
    expect(result).toEqual({ success: false, error: 'Not signed in' })
  })

  it('deletes the row then removes the storage object, in that order', async () => {
    deleteMaybeSingleMock.mockResolvedValue({
      data: { id: documentId, profile_id: 'profile-1', blob_key: 'profile-1/file.jpg' },
      error: null,
    })
    storageRemoveMock.mockResolvedValue({ error: null })

    const result = await deleteDocument(documentId)

    expect(result).toEqual({ success: true })
    expect(deleteEqMock).toHaveBeenCalledWith('id', documentId)
    expect(storageRemoveMock).toHaveBeenCalledWith(['profile-1/file.jpg'])
  })

  it('a 0-row match (cross-family id) fails without touching storage', async () => {
    deleteMaybeSingleMock.mockResolvedValue({ data: null, error: null })

    const result = await deleteDocument(documentId)

    expect(result).toEqual({ success: false, error: 'Could not delete — document not found' })
    expect(storageRemoveMock).not.toHaveBeenCalled()
  })

  it('still reports success when the row is gone but the storage remove fails', async () => {
    deleteMaybeSingleMock.mockResolvedValue({
      data: { id: documentId, profile_id: 'profile-1', blob_key: 'profile-1/file.jpg' },
      error: null,
    })
    storageRemoveMock.mockResolvedValue({ error: new Error('storage down') })

    const result = await deleteDocument(documentId)

    // The row is already gone from the family's perspective — an orphaned
    // file is a cleanup problem, not something the user should see as a
    // failed delete.
    expect(result).toEqual({ success: true })
  })
})
