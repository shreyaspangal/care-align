import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within, userEvent } from 'storybook/test'
import { DocumentClassificationEditor } from './DocumentClassificationEditor'

const meta = {
  component: DocumentClassificationEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    documentId: 'doc-demo-001',
    current: {
      type: 'lab_report',
      purpose: 'Pre-operation blood work',
      source_hospital: 'Apollo Hospitals',
      source_department: 'Pathology',
      document_date: '2024-01-15',
    },
  },
} satisfies Meta<typeof DocumentClassificationEditor>

export default meta
type Story = StoryObj<typeof meta>

// View mode — shows current classification with edit button
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Lab Report')).toBeVisible()
    await expect(canvas.getByText('Pre-operation blood work')).toBeVisible()
    await expect(canvas.getByLabelText('Edit classification')).toBeVisible()
  },
}

// Edit mode — user clicks pencil, form opens
export const EditMode: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByLabelText('Edit classification'))
    await expect(canvas.getByText('Edit classification')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /save/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /cancel/i })).toBeVisible()
  },
}

// Minimal — null optional fields
export const Minimal: Story = {
  args: {
    current: {
      type: 'bill',
      purpose: null,
      source_hospital: null,
      source_department: null,
      document_date: null,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Bill')).toBeVisible()
  },
}
