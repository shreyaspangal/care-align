import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { CaptureButton } from './CaptureButton'

const meta = {
  title: 'Features/CaptureButton',
  component: CaptureButton,
  args: {
    profileId: '00000000-0000-0000-0000-000000000001',
    createDocument: fn(),
  },
} satisfies Meta<typeof CaptureButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    createDocument: fn(async () => ({ success: true as const, documentId: 'doc-1' })),
  },
}

export const ServerError: Story = {
  args: {
    createDocument: fn(async () => ({
      success: false as const,
      error: 'Could not save the document',
    })),
  },
}
