import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { UserProfileMenu } from './UserProfileMenu'

const meta = {
  component: UserProfileMenu,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    name: 'Ramesh Kumar',
    email: 'ramesh@example.com',
    initial: 'R',
    onLogout: fn(),
  },
} satisfies Meta<typeof UserProfileMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongName: Story = {
  args: {
    name: 'Subramaniam Venkataraman',
    email: 'subramaniam.venkataraman@hospital.org',
    initial: 'S',
  },
}
