import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { RevokeAccessButton } from './RevokeAccessButton'

const meta = {
  component: RevokeAccessButton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    patientName: 'Ramesh Sharma',
    patientId: 'patient-fixture-id',
  },
} satisfies Meta<typeof RevokeAccessButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onRevoke: fn(() => Promise.resolve({ ok: true as const })),
  },
}

export const RevokeError: Story = {
  name: 'Error state',
  args: {
    onRevoke: fn(() => Promise.resolve({ ok: false as const, error: 'Could not revoke access. Please try again.' })),
  },
}
