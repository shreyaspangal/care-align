import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { PatientInviteButton } from './PatientInviteButton'

const meta = {
  component: PatientInviteButton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    patientId: 'patient-fixture-id',
    patientName: 'Ramesh Sharma',
  },
} satisfies Meta<typeof PatientInviteButton>

export default meta
type Story = StoryObj<typeof meta>

export const WithPin: Story = {
  name: 'Generates link + access code',
  args: {
    onCreateInvite: fn(() => Promise.resolve({
      ok: true as const,
      url: 'http://localhost:3000/join/abc123def456abc123def456abc123',
      pin: '482731',
    })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Share with patient/i })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Share with patient/i }))
  },
}

export const WithoutPin: Story = {
  name: 'Generates link only (no code)',
  args: {
    onCreateInvite: fn(() => Promise.resolve({
      ok: true as const,
      url: 'http://localhost:3000/join/abc123def456abc123def456abc123',
      pin: null,
    })),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Share with patient/i }))
  },
}

export const InviteError: Story = {
  name: 'Error state',
  args: {
    onCreateInvite: fn(() => Promise.resolve({
      ok: false as const,
      error: 'Not authorised to invite for this patient.',
    })),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Share with patient/i }))
  },
}
