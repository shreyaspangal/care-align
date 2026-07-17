import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { LoginForm } from './LoginForm'

const meta = {
  title: 'Features/LoginForm',
  component: LoginForm,
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
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ServerError: Story = {
  args: {
    action: fn(async () => ({ error: 'Wrong email or password' })),
  },
}
