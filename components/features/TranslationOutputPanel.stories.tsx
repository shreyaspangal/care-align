import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { TranslationOutputPanel } from './TranslationOutputPanel'

const doc = {
  id: 'doc-001',
  name: 'Blood Test Report — CBC Panel',
  type: 'lab_report' as const,
  document_date: '2024-03-15',
  source_hospital: 'Apollo Hospital, Bannerghatta',
  status: 'translated' as const,
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
    {
      id: 'a2',
      description: 'Ask doctor about the white blood cell count at next visit',
      category: 'doctor_visit' as const,
      action_for: 'patient' as const,
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
  play: async () => {
    const body = document.body
    await expect(body.querySelector('[data-slot="sheet-title"]')).toBeTruthy()
    await expect(body.textContent).toContain('Blood Test Report — CBC Panel')
    await expect(body.textContent).toContain('Apollo Hospital')
    await expect(body.textContent).toContain('What this document says')
    await expect(body.textContent).toContain('Actions required')
    await expect(body.textContent).toContain('Coordinator')
    await expect(body.textContent).toContain('Patient')
  },
}

export const PatientView: Story = {
  args: { viewerRole: 'patient' },
  play: async () => {
    const body = document.body
    await expect(body.textContent).toContain('What this document says')
    await expect(body.textContent).toContain('What you need to do')
    await expect(body.textContent).not.toContain('Actions required')
  },
}

export const Pending: Story = {
  name: 'Processing (pending)',
  args: {
    document: { ...doc, status: 'pending_classification' as const },
    translation: null,
  },
  play: async () => {
    const body = document.body
    await expect(body.textContent).toContain('Reading document')
  },
}

export const Translating: Story = {
  name: 'Processing (classifying)',
  args: {
    document: { ...doc, status: 'classified' as const },
    translation: null,
  },
  play: async () => {
    const body = document.body
    await expect(body.textContent).toContain('Translating')
  },
}

export const Failed: Story = {
  name: 'Failed to process',
  args: {
    document: { ...doc, status: 'failed' as const },
    translation: null,
  },
  play: async () => {
    const body = document.body
    await expect(body.textContent).toContain('Could not process this document')
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
