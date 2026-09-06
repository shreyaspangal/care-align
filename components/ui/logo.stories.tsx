import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Logo } from './logo'

const meta = {
  title: 'UI/Logo',
  component: Logo,
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
  args: { size: 'sm' },
}

export const Large: Story = {
  args: { size: 'lg' },
}

export const LightOnDark: Story = {
  args: { variant: 'light' },
  decorators: [
    (Story) => (
      <div className="bg-foreground p-6">
        <Story />
      </div>
    ),
  ],
}
