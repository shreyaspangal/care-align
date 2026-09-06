import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Label } from './label'
import { Input } from './input'

const meta = {
  title: 'UI/Label',
  component: Label,
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Email address',
  },
}

export const WithControl: Story = {
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Label {...args} htmlFor="story-email">
        Email address
      </Label>
      <Input id="story-email" type="email" placeholder="you@example.com" />
    </div>
  ),
}

export const Disabled: Story = {
  render: (args) => (
    <div className="group flex flex-col gap-1.5" data-disabled="true">
      <Label {...args} htmlFor="story-email-disabled">
        Email address
      </Label>
      <Input id="story-email-disabled" type="email" disabled />
    </div>
  ),
}
