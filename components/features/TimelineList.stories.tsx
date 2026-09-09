import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { TimelineList } from './TimelineList'
import type { TimelineItem } from '@/lib/dal/timeline'
import type { LoadMoreTimelineResult } from '@/actions/timeline'
import type { DocumentActionResult } from '@/actions/documents'
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

const document2: DocumentSummary = {
  ...document1,
  id: 'doc-2',
  title: 'Prescription',
  docType: 'prescription',
  documentDate: '2026-06-01',
  eventDate: '2026-06-01',
}

const items: TimelineItem[] = [
  { kind: 'document', id: document2.id, eventDate: document2.eventDate, document: document2 },
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
  title: 'Features/TimelineList',
  component: TimelineList,
  args: {
    profileId: 'profile-1',
    initialItems: items,
    initialCursor: null,
    loadMoreTimelineItems: fn(),
    retryOrganize: fn(retryOrganize),
    updateDocumentDetails: fn(updateDocumentDetails),
  },
} satisfies Meta<typeof TimelineList>

export default meta
type Story = StoryObj<typeof meta>

export const TwoDocuments: Story = {}

export const Empty: Story = {
  args: { initialItems: [] },
}

export const LoadsMoreOnScroll: Story = {
  args: {
    initialCursor: { eventDate: '2026-03-12', id: 'doc-1' },
    loadMoreTimelineItems: fn(
      async (): Promise<LoadMoreTimelineResult> => ({
        success: true,
        page: {
          items: [
            {
              kind: 'document',
              id: 'doc-3',
              eventDate: '2026-01-01',
              document: { ...document1, id: 'doc-3', title: 'Older Report', eventDate: '2026-01-01' },
            },
          ],
          nextCursor: null,
        },
      })
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sentinel = canvasElement.querySelector('[aria-hidden]')
    sentinel?.scrollIntoView()
    await waitFor(() => expect(canvas.getByText('Older Report')).toBeInTheDocument())
  },
}
