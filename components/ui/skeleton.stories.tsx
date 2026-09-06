import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Skeleton } from './skeleton'

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'h-4 w-48',
  },
}

export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2" role="status" aria-label="Loading document">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  ),
}

export const Avatar: Story = {
  render: () => <Skeleton className="size-10 rounded-full" role="status" aria-label="Loading profile" />,
}
