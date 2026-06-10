import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { EpisodeStatusBadge } from './EpisodeStatusBadge'

/**
 * Coloured badge with an animated dot indicator showing the current
 * episode lifecycle state.
 *
 * There are exactly three states in V1:
 * - `active` — patient is currently admitted
 * - `care_complete` — medical clearance given, admin still pending
 * - `closed` — episode fully resolved
 */
const meta = {
  component: EpisodeStatusBadge,
  tags: ['ai-generated'],
  argTypes: {
    status: {
      control: 'radio',
      options: ['active', 'care_complete', 'closed'],
      description: 'Episode lifecycle state',
    },
  },
} satisfies Meta<typeof EpisodeStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { status: 'active' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Active')).toBeVisible()
  },
}

export const CareComplete: Story = { args: { status: 'care_complete' } }
export const Closed: Story = { args: { status: 'closed' } }

export const AllStates: Story = {
  name: 'All states',
  args: { status: 'active' },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <EpisodeStatusBadge status="active" />
      <EpisodeStatusBadge status="care_complete" />
      <EpisodeStatusBadge status="closed" />
    </div>
  ),
}
