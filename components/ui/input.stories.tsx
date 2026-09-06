import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'UI/Input',
  component: Input,
  args: {
    onChange: fn(),
  },
  render: (args) => (
    <div className="flex w-64 flex-col gap-1.5">
      <Label htmlFor="story-input">Family member name</Label>
      <Input id="story-input" {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'e.g. Aparna',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Aparna Rao',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Aparna Rao',
  },
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    defaultValue: '',
  },
}
