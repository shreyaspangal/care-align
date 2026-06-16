import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { DocumentsSection } from './DocumentsSection'

const DOCS = [
  {
    id: 'doc-1',
    name: 'Apollo Pharmacy Prescription',
    type: 'prescription' as const,
    purpose: 'Antibiotic course post-surgery',
    document_date: '2024-06-12',
    created_at: '2024-06-12T09:30:00Z',
    status: 'translated' as const,
    translation: null,
  },
  {
    id: 'doc-2',
    name: 'CBC Blood Report',
    type: 'lab_report' as const,
    purpose: 'Routine post-op blood work',
    document_date: '2024-06-11',
    created_at: '2024-06-11T14:15:00Z',
    status: 'translated' as const,
    translation: null,
  },
]

const meta = {
  component: DocumentsSection,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DocumentsSection>

export default meta
type Story = StoryObj<typeof meta>

export const WithDocuments: Story = {
  name: 'With documents',
  args: { documents: DOCS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Uploaded documents')).toBeVisible()
    await expect(canvas.getByText('Apollo Pharmacy Prescription')).toBeVisible()
  },
}

export const Empty: Story = {
  name: 'No documents (renders nothing)',
  args: { documents: [] },
}
