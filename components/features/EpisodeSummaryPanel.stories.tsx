import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect, userEvent } from 'storybook/test'
import { EpisodeSummaryPanel } from './EpisodeSummaryPanel'

const summary = {
  visit_purpose:
    'Dad was admitted for investigation of chest pain and scheduled for a cardiac stress test.',
  timeline_summary:
    'On admission, an ECG and blood tests were taken. Results showed normal cardiac markers.\n\nA stress test was completed on Day 2. The cardiologist reviewed results on Day 3 and confirmed no structural issues.',
  status_label: 'Stable',
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
    episodeId: 'episode-fixture-id',
    episodeStatus: 'active',
    summary,
    openTaskCounts,
    patientId: 'patient-fixture-id',
    onUpdateStatus: fn().mockResolvedValue({ ok: true }),
  },
} satisfies Meta<typeof EpisodeSummaryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Episode Summary')).toBeVisible()
    await expect(canvas.getByText('Active')).toBeVisible()
    await expect(canvas.getByText('Why admitted')).toBeVisible()
    await expect(canvas.getByText('What has happened')).toBeVisible()
    await expect(canvas.getByText('Open tasks')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Mark care complete' })).toBeVisible()
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
      canvas.getByText('No summary yet — it will generate after the first document is processed.')
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Mark care complete' })).toBeVisible()
  },
}

export const CareComplete: Story = {
  args: { episodeStatus: 'care_complete' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Care Complete')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Close episode' })).toBeVisible()
  },
}

export const Closed: Story = {
  args: { episodeStatus: 'closed' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Closed')).toBeVisible()
    await expect(canvas.getByText(/no further changes/i)).toBeVisible()
  },
}

export const ConfirmTransition: Story = {
  name: 'Confirm step — mark care complete',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mark care complete' }))
    await expect(canvas.getByText(/medically cleared/i)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeVisible()
  },
}
