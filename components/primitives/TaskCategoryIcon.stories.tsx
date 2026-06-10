import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { TaskCategoryIcon } from './TaskCategoryIcon'

/**
 * Lucide icon representing a pending task category in the task list.
 *
 * Each category maps to a fixed icon — this is intentional so the
 * coordinator can scan the task list without reading category labels.
 * Used inside `PendingTaskRow`.
 */
const meta = {
  component: TaskCategoryIcon,
  tags: ['ai-generated'],
  argTypes: {
    category: {
      control: 'select',
      options: ['insurance', 'medication', 'doctor_visit', 'lifestyle', 'test_results', 'forms', 'payment'],
      description: 'Task category — determines which Lucide icon renders',
    },
    size: {
      control: 'number',
      description: 'Icon size in px (default 16)',
    },
  },
} satisfies Meta<typeof TaskCategoryIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Insurance: Story = { args: { category: 'insurance', size: 24 } }
export const Medication: Story = { args: { category: 'medication', size: 24 } }
export const DoctorVisit: Story = { args: { category: 'doctor_visit', size: 24 } }
export const Lifestyle: Story = { args: { category: 'lifestyle', size: 24 } }
export const TestResults: Story = { args: { category: 'test_results', size: 24 } }
export const Forms: Story = { args: { category: 'forms', size: 24 } }
export const Payment: Story = { args: { category: 'payment', size: 24 } }

export const AllCategories: Story = {
  name: 'All categories',
  args: { category: 'medication' },
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      {(['insurance', 'medication', 'doctor_visit', 'lifestyle', 'test_results', 'forms', 'payment'] as const).map(
        (category) => (
          <div key={category} className="flex flex-col items-center gap-1">
            <TaskCategoryIcon category={category} size={24} />
            <span className="text-xs text-muted-foreground">{category}</span>
          </div>
        )
      )}
    </div>
  ),
}

export const SizeVariants: Story = {
  name: 'Size variants',
  args: { category: 'medication' },
  render: () => (
    <div className="flex items-center gap-4">
      {[12, 16, 20, 24, 32].map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <TaskCategoryIcon category="medication" size={size} />
          <span className="text-xs text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  ),
}
