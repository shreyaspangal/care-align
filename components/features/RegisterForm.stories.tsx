import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { RegisterForm } from './RegisterForm'

const meta = {
  title: 'Features/RegisterForm',
  component: RegisterForm,
  args: {
    action: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RegisterForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ServerError: Story = {
  args: {
    action: fn(async () => ({ error: 'This email is already registered' })),
  },
}

export const ConfirmationEmailSent: Story = {
  args: {
    action: fn(async () => ({
      message: 'Check your email to confirm your account, then log in.',
    })),
  },
}
