import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { SearchableTimeline } from './SearchableTimeline'
import type { TimelineItem } from '@/lib/dal/timeline'
import type { DocumentActionResult } from '@/actions/documents'
import type { SearchResult } from '@/actions/search'
import type { DocumentSummary } from '@/lib/dal/documents'
import type { DOC_TYPES } from '@/lib/types/domain'

const document1: DocumentSummary = {
  id: 'doc-1',
  status: 'organized',
  docType: 'lab_report',
  title: 'Lipid Profile',
  titleIsGuessed: false,
  documentDate: '2026-03-12',
  doctorName: 'Dr. R. K. Sharma',
  facilityName: 'Apollo Clinic',
  capturedAt: '2026-03-12T12:00:00Z',
  eventDate: '2026-03-12',
}

const items: TimelineItem[] = [
  { kind: 'document', id: document1.id, eventDate: document1.eventDate, document: document1 },
]

const retryOrganize: (documentId: string) => Promise<DocumentActionResult> = async () => ({
  success: true,
})
const updateDocumentDetails: (input: {
  documentId: string
  docType: (typeof DOC_TYPES)[number]
  title: string
  documentDate: string | null
  doctorName: string | null
  facilityName: string | null
}) => Promise<DocumentActionResult> = async () => ({ success: true })

const meta = {
  title: 'Features/SearchableTimeline',
  component: SearchableTimeline,
  args: {
    profileId: 'profile-1',
    initialItems: items,
    initialCursor: null,
    loadMoreTimelineItems: fn(),
    retryOrganize: fn(retryOrganize),
    updateDocumentDetails: fn(updateDocumentDetails),
    searchDocuments: fn(),
  },
} satisfies Meta<typeof SearchableTimeline>

export default meta
type Story = StoryObj<typeof meta>

export const ShowsTimelineByDefault: Story = {}

export const Empty: Story = {
  args: { initialItems: [] },
}

export const SearchWithResults: Story = {
  args: {
    searchDocuments: fn(
      async (): Promise<SearchResult> => ({
        success: true,
        items: [{ ...document1, id: 'doc-search-1', title: 'Fasting Blood Sugar' }],
      })
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox'), 'fasting sugar')
    await waitFor(() => expect(canvas.getByText('Fasting Blood Sugar')).toBeInTheDocument())
    await expect(canvas.queryByText('Lipid Profile')).not.toBeInTheDocument()
  },
}

export const SearchWithNoMatches: Story = {
  args: {
    searchDocuments: fn(async (): Promise<SearchResult> => ({ success: true, items: [] })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox'), 'nonexistent')
    await waitFor(() => expect(canvas.getByText(/No documents match/)).toBeInTheDocument())
  },
}
