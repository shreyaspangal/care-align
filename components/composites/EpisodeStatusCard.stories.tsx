import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { EpisodeStatusCard } from './EpisodeStatusCard'

/**
 * The summary header card at the top of the coordinator dashboard.
 *
 * Assembled from `EpisodeStatusBadge`. Displays Claude's living
 * episode summary — `status_label` is the headline, `status_description`
 * is the plain-language explanation the patient can also read.
 *
 * `version` increments on each AI regeneration via `upsert_episode_summary` RPC.
 * `updated_at` renders as a relative time string ("5m ago", "2h ago").
 */
const meta = {
  component: EpisodeStatusCard,
  tags: ['ai-generated'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof EpisodeStatusCard>

export default meta
type Story = StoryObj<typeof meta>

const baseSummary = {
  status_label: 'Post-surgery recovery — Day 3',
  status_description:
    'Your father is recovering well after the appendectomy. Vitals are stable. The surgical team expects to clear him for discharge in 2–3 days pending one more blood test.',
  version: 3,
  updated_at: new Date(Date.now() - 8 * 60_000).toISOString(),
}

export const Active: Story = {
  args: { summary: baseSummary, episodeStatus: 'active' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Post-surgery recovery — Day 3')).toBeVisible()
    await expect(canvas.getByText('Active')).toBeVisible()
    await expect(canvas.getByText(/Updated/)).toBeVisible()
  },
}

export const CareComplete: Story = {
  args: {
    summary: {
      ...baseSummary,
      status_label: 'Medically cleared — awaiting final bill',
      status_description:
        'The doctor has given medical clearance. The final bill is being prepared. Once settled, the discharge papers will be issued.',
      version: 7,
      updated_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    },
    episodeStatus: 'care_complete',
  },
}

export const Closed: Story = {
  args: {
    summary: {
      ...baseSummary,
      status_label: 'Episode complete',
      status_description:
        'Your father has been discharged. All bills are settled and discharge papers have been issued. Follow up with Dr Sharma in 2 weeks.',
      version: 12,
      updated_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    },
    episodeStatus: 'closed',
  },
}

export const JustUpdated: Story = {
  name: 'Just updated ("just now")',
  args: {
    summary: {
      ...baseSummary,
      updated_at: new Date(Date.now() - 30_000).toISOString(),
    },
    episodeStatus: 'active',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/just now/i)).toBeVisible()
  },
}
