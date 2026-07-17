import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { PinForm } from './PinForm'

const meta = {
  title: 'Features/PinForm',
  component: PinForm,
  args: {
    action: fn(),
    label: 'Enter PIN',
    submitLabel: 'Unlock',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-xs p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PinForm>

export default meta
type Story = StoryObj<typeof meta>

export const Unlock: Story = {}

export const SetPin: Story = {
  args: {
    label: 'Choose a 4-digit PIN',
    submitLabel: 'Set PIN',
  },
}

export const WrongPin: Story = {
  args: {
    action: fn(async () => ({ error: 'Wrong PIN' })),
  },
}
