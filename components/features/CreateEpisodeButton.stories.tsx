import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { CreateEpisodeButton } from './CreateEpisodeButton'

const meta = {
  component: CreateEpisodeButton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { patientId: 'patient-demo-001' },
} satisfies Meta<typeof CreateEpisodeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /start new episode/i })).toBeVisible()
  },
}
