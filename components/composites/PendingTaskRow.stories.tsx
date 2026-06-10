import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { PendingTaskRow } from './PendingTaskRow'

/**
 * A single pending task row in the coordinator task list.
 *
 * Assembled from `TaskCategoryIcon` + Shadcn `Button`.
 * The resolve button only renders when `onResolve` is provided AND
 * `task.status === 'open'`. Resolved tasks render read-only.
 *
 * `onResolve` receives the `task.id` — the caller is responsible for
 * updating the task status via the `resolveTask` Server Action (Phase 7).
 */
const meta = {
  component: PendingTaskRow,
  tags: ['ai-generated'],
} satisfies Meta<typeof PendingTaskRow>

export default meta
type Story = StoryObj<typeof meta>

const base = {
  id: 'task-1',
  category: 'medication' as const,
  description: 'Collect discharge prescription from hospital pharmacy before leaving',
  status: 'open' as const,
  phase_appears: 'during_care' as const,
}

export const OpenWithResolve: Story = {
  args: { task: base, onResolve: fn() },
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button', { name: 'Resolve' })
    await expect(btn).toBeVisible()
    btn.click()
    await expect(args.onResolve).toHaveBeenCalledWith('task-1')
  },
}

export const OpenReadOnly: Story = {
  name: 'Open — no resolve button (read-only context)',
  args: { task: base },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Resolve' })).toBeNull()
  },
}

export const Resolved: Story = {
  args: { task: { ...base, status: 'resolved' }, onResolve: fn() },
  play: async ({ canvas }) => {
    // Resolve button suppressed even when onResolve provided
    await expect(canvas.queryByRole('button', { name: 'Resolve' })).toBeNull()
  },
}

export const AllCategories: Story = {
  name: 'All categories',
  args: { task: base },
  render: () => (
    <div className="w-96 border rounded-lg divide-y">
      {(['insurance', 'medication', 'doctor_visit', 'lifestyle', 'test_results', 'forms', 'payment'] as const).map(
        (category) => (
          <PendingTaskRow
            key={category}
            task={{ ...base, id: category, category, description: `Example ${category.replace('_', ' ')} task` }}
            onResolve={() => {}}
          />
        )
      )}
    </div>
  ),
}
