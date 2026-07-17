import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { ProfileForm } from './ProfileForm'

const meta = {
  title: 'Features/ProfileForm',
  component: ProfileForm,
  args: {
    action: fn(),
    submitLabel: 'Add profile',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileForm>

export default meta
type Story = StoryObj<typeof meta>

export const AddNew: Story = {}

export const EditExisting: Story = {
  args: {
    submitLabel: 'Save changes',
    defaults: {
      name: 'Ramesh Pangal',
      dob: '1962-04-15',
      sex: 'male',
      color: 'brand',
    },
  },
}

export const ServerError: Story = {
  args: {
    action: fn(async () => ({ error: 'Could not create the profile' })),
  },
}
