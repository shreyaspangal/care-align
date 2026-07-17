import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ProfileGrid } from './ProfileGrid'

const meta = {
  title: 'Features/ProfileGrid',
  component: ProfileGrid,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Family: Story = {
  args: {
    profiles: [
      { id: '1', name: 'Ramesh Pangal', dob: '1962-04-15', sex: 'male', color: 'brand', hasPin: false },
      { id: '2', name: 'Sunita Pangal', dob: '1968-11-02', sex: 'female', color: 'accent', hasPin: true },
      { id: '3', name: 'Shreyas', dob: null, sex: null, color: 'ai', hasPin: false },
    ],
  },
}

export const EmptyFamily: Story = {
  args: { profiles: [] },
}
