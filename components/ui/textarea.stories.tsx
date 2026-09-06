import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { Textarea } from './textarea'
import { Label } from './label'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  args: {
    onChange: fn(),
  },
  render: (args) => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="story-textarea">Notes for this document</Label>
      <Textarea id="story-textarea" {...args} />
    </div>
  ),
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Add a note for the family...',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Follow up with the clinic in 3 months.',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Follow up with the clinic in 3 months.',
  },
}
