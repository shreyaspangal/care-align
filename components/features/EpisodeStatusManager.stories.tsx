import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect, userEvent } from 'storybook/test'
import { EpisodeStatusManager } from './EpisodeStatusManager'

const meta = {
  component: EpisodeStatusManager,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    episodeId: 'episode-fixture-id',
    onUpdateStatus: fn().mockResolvedValue({ ok: true }),
  },
} satisfies Meta<typeof EpisodeStatusManager>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { currentStatus: 'active' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Active')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Mark care complete' })).toBeVisible()
  },
}

export const ActiveConfirming: Story = {
  name: 'Active — confirm step',
  args: { currentStatus: 'active' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mark care complete' }))
    await expect(canvas.getByText(/medically cleared/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible()
  },
}

export const CareComplete: Story = {
  name: 'Care complete',
  args: { currentStatus: 'care_complete' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Care Complete')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Close episode' })).toBeVisible()
  },
}

export const Closed: Story = {
  args: { currentStatus: 'closed' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Closed')).toBeVisible()
    await expect(canvas.getByText(/no further changes/i)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /episode|complete/i })).not.toBeInTheDocument()
  },
}
