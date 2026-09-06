import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SearchIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group'
import { Label } from './label'

const meta = {
  title: 'UI/InputGroup',
  component: InputGroup,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="search-docs">Search documents</Label>
      <InputGroup>
        <InputGroupInput id="search-docs" placeholder="Blood test, prescription..." />
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const WithTrailingButton: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="clear-search">Search documents</Label>
      <InputGroup>
        <InputGroupInput id="clear-search" defaultValue="blood test" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Clear search">Clear</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}

export const WithLeadingText: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="dosage">Dosage</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>mg</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id="dosage" placeholder="500" />
      </InputGroup>
    </div>
  ),
}

export const WithTextarea: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="notes">Notes</Label>
      <InputGroup>
        <InputGroupTextarea id="notes" placeholder="Add a note for the family..." />
      </InputGroup>
    </div>
  ),
}
