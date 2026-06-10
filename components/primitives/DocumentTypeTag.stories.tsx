import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { DocumentTypeTag } from './DocumentTypeTag'

/**
 * Displays the medical document type as a coloured pill label.
 *
 * Used in DocumentCard, EpisodeSummary, and anywhere a document type
 * needs to be identified at a glance. Colour + label are fixed per type —
 * this is intentional for V1 consistency.
 */
const meta = {
  component: DocumentTypeTag,
  tags: ['ai-generated'],
  argTypes: {
    type: {
      control: 'select',
      options: ['prescription', 'lab_report', 'discharge_summary', 'bill', 'observation_note', 'other'],
      description: 'Medical document type — drives colour and label',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md'],
      description: 'Visual size of the tag',
    },
  },
} satisfies Meta<typeof DocumentTypeTag>

export default meta
type Story = StoryObj<typeof meta>

export const Prescription: Story = {
  args: { type: 'prescription' },
  play: async ({ canvas }) => {
    const tag = canvas.getByText('Prescription')
    await expect(tag).toBeVisible()
    // Blue pill — proves CSS loaded
    await expect(getComputedStyle(tag).color).not.toBe('rgb(0, 0, 0)')
  },
}

export const CssCheck: Story = {
  name: 'CSS Check — blue pill for prescription',
  args: { type: 'prescription', size: 'md' },
  play: async ({ canvas }) => {
    const tag = canvas.getByText('Prescription')
    // bg-blue-50 in Tailwind v4 uses oklch colour space
    await expect(getComputedStyle(tag).backgroundColor).toBe('oklch(0.97 0.014 254.604)')
  },
}

export const LabReport: Story = { args: { type: 'lab_report' } }
export const DischargeSummary: Story = { args: { type: 'discharge_summary' } }
export const Bill: Story = { args: { type: 'bill' } }
export const ObservationNote: Story = { args: { type: 'observation_note' } }
export const Other: Story = { args: { type: 'other' } }

export const AllTypes: Story = {
  name: 'All types — size sm',
  args: { type: 'prescription' },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['prescription', 'lab_report', 'discharge_summary', 'bill', 'observation_note', 'other'] as const).map(
        (type) => <DocumentTypeTag key={type} type={type} size="sm" />
      )}
    </div>
  ),
}

export const SizeMd: Story = {
  name: 'All types — size md',
  args: { type: 'prescription' },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['prescription', 'lab_report', 'discharge_summary', 'bill', 'observation_note', 'other'] as const).map(
        (type) => <DocumentTypeTag key={type} type={type} size="md" />
      )}
    </div>
  ),
}
