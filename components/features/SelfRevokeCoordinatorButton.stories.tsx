import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect } from 'storybook/test'
import { SelfRevokeCoordinatorButton } from './SelfRevokeCoordinatorButton'

const meta = {
  component: SelfRevokeCoordinatorButton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    patientName: 'Ramesh Sharma',
    patientId: 'patient-fixture-id',
  },
} satisfies Meta<typeof SelfRevokeCoordinatorButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSelfRevoke: fn(() => Promise.resolve({ ok: true as const })),
  },
}

export const OnlyCoordinatorGuard: Story = {
  name: 'Guarded — only coordinator',
  args: {
    onSelfRevoke: fn(() => Promise.resolve({
      ok: false as const,
      error: "You're the only coordinator for this patient. Removing yourself now would leave nobody able to manage this record.",
    })),
  },
  // The confirmation dialog renders in a portal outside this story's canvas
  // (same as RevokeAccessButton's dialog) — verify the trigger only.
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Leave' })).toBeVisible()
  },
}
