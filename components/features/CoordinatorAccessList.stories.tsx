import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect } from 'storybook/test'
import { CoordinatorAccessList } from './CoordinatorAccessList'

const COORDINATORS = [
  { userId: 'user-001', name: 'Anjali Sharma', provenance: 'coordinator_attested' as const, grantedAt: '2026-06-20T10:00:00.000Z' },
  { userId: 'user-002', name: 'Vikram Sharma', provenance: 'self_consented' as const, grantedAt: '2026-06-25T10:00:00.000Z' },
]

const meta = {
  component: CoordinatorAccessList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    patientId: 'patient-fixture-id',
  },
} satisfies Meta<typeof CoordinatorAccessList>

export default meta
type Story = StoryObj<typeof meta>

export const WithCoordinators: Story = {
  name: 'Two coordinators, different provenance',
  args: {
    coordinators: COORDINATORS,
    onRevoke: fn(() => Promise.resolve({ ok: true as const })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Anjali Sharma')).toBeVisible()
    await expect(canvas.getByText('Added you before you could sign in yourself')).toBeVisible()
    await expect(canvas.getByText('Vikram Sharma')).toBeVisible()
    await expect(canvas.getByText('Joined with your consent')).toBeVisible()
  },
}

export const Empty: Story = {
  name: 'No coordinators',
  args: {
    coordinators: [],
    onRevoke: fn(() => Promise.resolve({ ok: true as const })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Nobody currently has coordinator access to this record.')).toBeVisible()
  },
}

export const RevokeError: Story = {
  name: 'Revoke error state',
  args: {
    coordinators: [COORDINATORS[0]],
    onRevoke: fn(() => Promise.resolve({ ok: false as const, error: 'Could not revoke access. Please try again.' })),
  },
  // The confirmation dialog itself renders in a portal outside this story's
  // canvas (same as RevokeAccessButton's dialog) — verify the trigger only.
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Revoke access' })).toBeVisible()
  },
}
