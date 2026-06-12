import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { TranslationOutputPanel } from './TranslationOutputPanel'

const doc = {
  id: 'doc-001',
  name: 'Blood Test Report — CBC Panel',
  type: 'lab_report' as const,
  document_date: '2024-03-15',
}

const translation = {
  plain_language:
    'This is a complete blood count test. All values are within normal range. The haemoglobin is 13.2 g/dL which is normal for an adult male. White blood cell count is slightly elevated at 11,000 which is worth monitoring.',
  what_it_means:
    'The results are mostly normal. The slightly elevated white cell count is being watched by the doctor and is not a cause for immediate concern.',
  actions: [
    {
      id: 'a1',
      description: 'Collect follow-up blood test report from ward nurse on Wednesday',
      category: 'test_results' as const,
      action_for: 'coordinator' as const,
      phase_appears: 'during_care' as const,
    },
  ],
}

const meta = {
  component: TranslationOutputPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: () => {},
    document: doc,
    translation,
    viewerRole: 'coordinator',
  },
} satisfies Meta<typeof TranslationOutputPanel>

export default meta
type Story = StoryObj<typeof meta>

export const CoordinatorView: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Blood Test Report — CBC Panel')).toBeVisible()
    await expect(canvas.getByText('What this document says')).toBeVisible()
    await expect(canvas.getByText('Actions required')).toBeVisible()
  },
}

export const PatientView: Story = {
  args: { viewerRole: 'patient' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('What this document says')).toBeVisible()
    // Actions section hidden for patient
    await expect(canvas.queryByText('Actions required')).toBeNull()
  },
}

export const Loading: Story = {
  args: { translation: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Blood Test Report — CBC Panel')).toBeVisible()
  },
}

export const NoActions: Story = {
  args: {
    translation: { ...translation, actions: [] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Actions required')).toBeNull()
  },
}
