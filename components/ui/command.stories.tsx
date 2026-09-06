import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './command'

const meta = {
  title: 'UI/Command',
  component: Command,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Command>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Command className="w-80 border">
      <CommandInput placeholder="Search documents or family members..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Family members">
          <CommandItem>Aparna Rao</CommandItem>
          <CommandItem>Rohan Rao</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Documents">
          <CommandItem>
            Blood test — 12 Mar 2026
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>Prescription — 4 Jan 2026</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
}

export const Empty: Story = {
  render: () => (
    <Command className="w-80 border">
      <CommandInput placeholder="Search documents or family members..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
    </Command>
  ),
}

export const InDialog: Story = {
  render: () => (
    <CommandDialog open title="Search" description="Search documents or family members">
      <Command>
        <CommandInput placeholder="Search documents or family members..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documents">
            <CommandItem>Blood test — 12 Mar 2026</CommandItem>
            <CommandItem>Prescription — 4 Jan 2026</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  ),
}
