import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Separator } from './separator'

const meta = {
  title: 'UI/Separator',
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64">
      <div className="text-sm">Documents</div>
      <Separator {...args} className="my-2" />
      <div className="text-sm text-muted-foreground">Appointments</div>
    </div>
  ),
}

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-8 items-center gap-3">
      <span className="text-sm">Timeline</span>
      <Separator {...args} orientation="vertical" />
      <span className="text-sm">Search</span>
    </div>
  ),
}
