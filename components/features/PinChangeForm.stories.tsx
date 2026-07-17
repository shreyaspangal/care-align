import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { PinChangeForm } from './PinChangeForm'

const meta = {
  title: 'Features/PinChangeForm',
  component: PinChangeForm,
  args: {
    action: fn(),
    mode: 'change',
    submitLabel: 'Save new PIN',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-xs p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PinChangeForm>

export default meta
type Story = StoryObj<typeof meta>

export const ChangePin: Story = {}

export const RemovePin: Story = {
  args: {
    mode: 'remove',
    submitLabel: 'Remove PIN',
  },
}

export const WrongVerification: Story = {
  args: {
    action: fn(async () => ({ error: 'Wrong PIN' })),
  },
}
