import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { DocumentCard } from './DocumentCard'
import type { DocumentSummary } from '@/lib/dal/documents'

const base: DocumentSummary = {
  id: 'doc-1',
  status: 'uploaded',
  docType: null,
  title: null,
  titleIsGuessed: false,
  documentDate: null,
  doctorName: null,
  facilityName: null,
  capturedAt: '2026-09-06T12:00:00Z',
}

const meta = {
  title: 'Features/DocumentCard',
  component: DocumentCard,
  args: {
    document: base,
    retryOrganize: fn(),
    updateDocumentDetails: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentCard>

export default meta
type Story = StoryObj<typeof meta>

export const Organizing: Story = {}

export const Organized: Story = {
  args: {
    document: {
      ...base,
      status: 'organized',
      docType: 'prescription',
      title: 'Prescription — Dr. Sharma',
      documentDate: '2026-03-12',
      doctorName: 'Dr. R. K. Sharma, MD',
      facilityName: 'Apollo Clinic, Bangalore',
    },
  },
}

export const OrganizedDateUnknown: Story = {
  args: {
    document: {
      ...base,
      status: 'organized',
      docType: 'lab_report',
      title: 'Lab report',
    },
  },
}

export const NeedsReview: Story = {
  args: {
    document: { ...base, status: 'needs_review' },
    retryOrganize: fn(async () => ({ success: true as const })),
    updateDocumentDetails: fn(async () => ({ success: true as const })),
  },
}

export const NeedsReviewSaveError: Story = {
  args: {
    document: { ...base, status: 'needs_review' },
    updateDocumentDetails: fn(async () => ({
      success: false as const,
      error: 'Could not save — document not found',
    })),
  },
}
