import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { EpisodeTimeline } from './EpisodeTimeline'
import type { TimelineDocument } from './EpisodeTimeline'

/**
 * Chronological document list for an episode. Clicking a card opens the
 * TranslationOutputPanel sheet for that document.
 *
 * Three document states drive the card's TranslationStatusIndicator:
 * - `pending_classification` → "Pending"
 * - `classified` → "Translating…"
 * - `translated` → "Translated" (sheet will show translation content)
 * - `failed` → "Failed"
 */
const meta = {
  component: EpisodeTimeline,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    viewerRole: 'coordinator',
  },
} satisfies Meta<typeof EpisodeTimeline>

export default meta
type Story = StoryObj<typeof meta>

// ── Fixture data ──────────────────────────────────────────────────────────────

const translatedDoc: TimelineDocument = {
  id: 'doc-001',
  name: 'CBC Blood Test Panel',
  type: 'lab_report',
  purpose: 'Routine blood count check during admission',
  document_date: '2026-06-01',
  created_at: '2026-06-01T09:30:00Z',
  status: 'translated',
  translation: {
    plain_language:
      'Your blood test shows that your red blood cells, white blood cells, and platelets are all within the normal range. No signs of infection or anaemia.',
    what_it_means:
      'The body is coping well with the current treatment. No immediate action is needed based on this test alone.',
    actions: [
      {
        id: 'action-001',
        description: 'Share this report with the attending physician at the next visit',
        category: 'doctor_visit',
        action_for: 'coordinator',
        phase_appears: 'during_care',
      },
    ],
  },
}

const pendingDoc: TimelineDocument = {
  id: 'doc-002',
  name: 'Prescription — Day 3',
  type: 'prescription',
  purpose: null,
  document_date: null,
  created_at: '2026-06-02T11:00:00Z',
  status: 'pending_classification',
  translation: null,
}

const classifyingDoc: TimelineDocument = {
  id: 'doc-003',
  name: 'discharge_summary.pdf',
  type: 'discharge_summary',
  purpose: null,
  document_date: '2026-06-10',
  created_at: '2026-06-10T15:45:00Z',
  status: 'classified',
  translation: null,
}

const failedDoc: TimelineDocument = {
  id: 'doc-004',
  name: 'hospital_bill.pdf',
  type: 'bill',
  purpose: null,
  document_date: '2026-06-12',
  created_at: '2026-06-12T08:20:00Z',
  status: 'failed',
  translation: null,
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const Empty: Story = {
  args: { documents: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No documents yet — get started by uploading the first one above.')).toBeVisible()
  },
}

export const EmptyPatientView: Story = {
  name: 'Empty — patient view',
  args: { documents: [], viewerRole: 'patient' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No documents have been processed yet. Your coordinator is working on it.')).toBeVisible()
  },
}

export const SingleTranslated: Story = {
  name: 'Single translated document',
  args: { documents: [translatedDoc] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('CBC Blood Test Panel')).toBeVisible()
    await expect(canvas.getByText('Translated')).toBeVisible()
  },
}

export const MixedStates: Story = {
  name: 'Mixed document states',
  args: {
    documents: [translatedDoc, classifyingDoc, pendingDoc, failedDoc],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('CBC Blood Test Panel')).toBeVisible()
    await expect(canvas.getByText('Translated')).toBeVisible()
    await expect(canvas.getByText('Translating...')).toBeVisible()
    await expect(canvas.getByText('Pending')).toBeVisible()
    await expect(canvas.getByText('Failed')).toBeVisible()
  },
}

export const WithDelete: Story = {
  name: 'With delete buttons (coordinator)',
  args: {
    documents: [translatedDoc, pendingDoc],
    onDelete: fn(),
  },
  play: async ({ canvas }) => {
    const deleteButtons = canvas.getAllByRole('button', { name: 'Delete document' })
    await expect(deleteButtons).toHaveLength(2)
  },
}

export const PatientView: Story = {
  name: 'Patient view (translated only visible)',
  args: {
    documents: [translatedDoc],
    viewerRole: 'patient',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('CBC Blood Test Panel')).toBeVisible()
  },
}
