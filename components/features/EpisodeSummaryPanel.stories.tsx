import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { EpisodeSummaryPanel } from './EpisodeSummaryPanel'

const summary = {
  visit_purpose:
    'Dad was admitted for investigation of chest pain and scheduled for a cardiac stress test.',
  timeline_summary:
    'On admission, an ECG and blood tests were taken. Results showed normal cardiac markers.\n\nA stress test was completed on Day 2. The cardiologist reviewed results on Day 3 and confirmed no structural issues.',
  status_label: 'Under observation',
  status_description: 'Dad is resting in ward 4. Doctor review is scheduled for tomorrow morning.',
  version: 3,
  updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
}

const openTaskCounts = [
  { category: 'doctor_visit' as const, count: 1 },
  { category: 'test_results' as const, count: 2 },
  { category: 'insurance' as const, count: 1 },
]

const meta = {
  component: EpisodeSummaryPanel,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    episodeStatus: 'active',
    summary,
    openTaskCounts,
    patientId: 'patient-fixture-id',
  },
} satisfies Meta<typeof EpisodeSummaryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Why admitted')).toBeVisible()
    await expect(canvas.getByText('What has happened')).toBeVisible()
    await expect(canvas.getByText('Open tasks')).toBeVisible()
  },
}

export const NoTasks: Story = {
  args: { openTaskCounts: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Open tasks')).toBeNull()
  },
}

export const Empty: Story = {
  name: 'No summary yet',
  args: { summary: null, openTaskCounts: [] },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Summary will appear after the first document is processed.')
    ).toBeVisible()
  },
}

export const CareComplete: Story = {
  args: { episodeStatus: 'care_complete' },
}
