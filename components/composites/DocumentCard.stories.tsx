import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { DocumentCard } from './DocumentCard'

/**
 * A single document entry in the episode timeline.
 *
 * Assembled from `DocumentTypeTag` + `TranslationStatusIndicator`.
 * Two fields have null-handling rules that must never be violated:
 * - `document_date: null` → renders "Date unknown" (never defaults to upload date)
 * - `purpose: null` → renders "Processing..." (never renders empty string)
 *
 * `onClick` opens the `TranslationOutputPanel` sheet (wired in Phase 5).
 * `onRetry` restarts the AI pipeline for failed documents (wired in Phase 6).
 */
const meta = {
  component: DocumentCard,
  tags: ['ai-generated'],
} satisfies Meta<typeof DocumentCard>

export default meta
type Story = StoryObj<typeof meta>

const base = {
  id: 'doc-1',
  name: 'CBC Blood Test Report',
  type: 'lab_report' as const,
  purpose: 'Routine haematology panel',
  document_date: '2024-06-01',
  translation_status: 'complete' as const,
}

export const Translated: Story = {
  args: { document: base, onClick: fn() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('CBC Blood Test Report')).toBeVisible()
    await expect(canvas.getByText('Lab Report')).toBeVisible()
    await expect(canvas.getByText('Translated')).toBeVisible()
  },
}

export const Pending: Story = {
  args: {
    document: { ...base, translation_status: 'pending', purpose: null },
  },
}

export const Translating: Story = {
  args: {
    document: { ...base, translation_status: 'translating', purpose: null },
  },
}

export const Failed: Story = {
  args: {
    document: { ...base, translation_status: 'failed' },
    onRetry: fn(),
  },
}

export const NullDateAndPurpose: Story = {
  name: 'Null date + null purpose',
  args: {
    document: { ...base, document_date: null, purpose: null, translation_status: 'pending' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Date unknown')).toBeVisible()
    await expect(canvas.getByText('Processing...')).toBeVisible()
  },
}

export const AllDocumentTypes: Story = {
  name: 'All document types',
  args: { document: base },
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      {(['prescription', 'lab_report', 'discharge_summary', 'bill', 'observation_note', 'other'] as const).map(
        (type) => (
          <DocumentCard
            key={type}
            document={{ ...base, type, name: `${type.replace('_', ' ')} document` }}
          />
        )
      )}
    </div>
  ),
}
