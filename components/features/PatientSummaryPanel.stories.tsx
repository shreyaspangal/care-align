import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { PatientSummaryPanel } from './PatientSummaryPanel'

/**
 * Plain-language episode summary shown to the patient.
 * Deliberately simpler than EpisodeSummaryPanel — no task counts,
 * no status badge, no coordinator jargon. Just: status, why admitted, what happened.
 */
const meta = {
  component: PatientSummaryPanel,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PatientSummaryPanel>

export default meta
type Story = StoryObj<typeof meta>

const fullSummary = {
  visit_purpose: 'Admitted for planned knee replacement surgery following six months of chronic pain.',
  timeline_summary:
    'Surgery was completed successfully on the first day.\n\nPost-operative physiotherapy began on day two and is progressing well.\n\nPain levels have reduced and you are eating normally.',
}

export const ActiveEpisode: Story = {
  name: 'Active episode with summary',
  args: {
    episodeStatus: 'active',
    summary: fullSummary,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('You are currently receiving care')).toBeVisible()
    await expect(canvas.getByText('Why you were admitted')).toBeVisible()
    await expect(canvas.getByText('What has happened so far')).toBeVisible()
    await expect(canvas.getByText(/knee replacement surgery/)).toBeVisible()
  },
}

export const CareComplete: Story = {
  name: 'Care complete',
  args: {
    episodeStatus: 'care_complete',
    summary: fullSummary,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your medical care is complete')).toBeVisible()
  },
}

export const Closed: Story = {
  name: 'Episode closed',
  args: {
    episodeStatus: 'closed',
    summary: fullSummary,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your episode has been closed')).toBeVisible()
  },
}

export const NoSummaryYet: Story = {
  name: 'No summary yet (progress steps)',
  args: {
    episodeStatus: 'active',
    summary: null,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your care status')).toBeVisible()
    await expect(canvas.getByText('Your care episode is open')).toBeVisible()
    await expect(canvas.getByText('Your coordinator is reviewing your documents')).toBeVisible()
    await expect(canvas.getByText('Your summary will appear here once ready')).toBeVisible()
  },
}
