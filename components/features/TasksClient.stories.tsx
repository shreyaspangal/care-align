import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect, userEvent } from 'storybook/test'
import { TasksClient } from './TasksClient'

/**
 * Coordinator task list for a hospitalisation episode.
 *
 * Key interactive states:
 * - List vs card view toggle (persisted in localStorage)
 * - Phase filter: "during_care" by default; toggle reveals post_discharge
 * - Resolve confirms inline, then applies optimistic strikethrough
 * - All-complete empty state when every visible task is resolved
 */
const meta = {
  component: TasksClient,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    onResolve: fn().mockResolvedValue({ ok: true }),
  },
} satisfies Meta<typeof TasksClient>

export default meta
type Story = StoryObj<typeof meta>

// ── Fixture data ──────────────────────────────────────────────────────────────

const duringCareTasks = [
  {
    id: 'task-001',
    category: 'insurance' as const,
    description: 'Submit pre-authorisation form to TPA before procedure',
    status: 'open' as const,
    phase_appears: 'during_care' as const,
    resolved_at: null,
  },
  {
    id: 'task-002',
    category: 'medication' as const,
    description: 'Collect prescribed antibiotics from hospital pharmacy',
    status: 'open' as const,
    phase_appears: 'during_care' as const,
    resolved_at: null,
  },
  {
    id: 'task-003',
    category: 'doctor_visit' as const,
    description: 'Schedule follow-up with cardiologist within 1 week',
    status: 'resolved' as const,
    phase_appears: 'during_care' as const,
    resolved_at: '2026-06-10T09:00:00Z',
  },
]

const postDischargeTasks = [
  {
    id: 'task-004',
    category: 'test_results' as const,
    description: 'Collect HbA1c test results from lab within 5 days',
    status: 'open' as const,
    phase_appears: 'post_discharge' as const,
    resolved_at: null,
  },
]

const allTasks = [...duringCareTasks, ...postDischargeTasks]

// ── Stories ───────────────────────────────────────────────────────────────────

export const Empty: Story = {
  args: { tasks: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/No tasks yet/)).toBeVisible()
  },
}

export const DuringCare: Story = {
  name: 'During-care tasks (default)',
  args: { tasks: duringCareTasks },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('2 open tasks')).toBeVisible()
    await expect(canvas.getByText('Submit pre-authorisation form to TPA before procedure')).toBeVisible()
    await expect(canvas.queryByText('Collect HbA1c test results from lab within 5 days')).not.toBeInTheDocument()
  },
}

export const WithPostDischarge: Story = {
  name: 'With post-discharge tasks (hidden until toggled)',
  args: { tasks: allTasks },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Collect HbA1c test results from lab within 5 days')).not.toBeInTheDocument()
    const toggle = canvas.getByRole('button', { name: /Show post-discharge/ })
    await userEvent.click(toggle)
    await expect(canvas.getByText('Collect HbA1c test results from lab within 5 days')).toBeVisible()
  },
}

export const CardView: Story = {
  name: 'Card view (grouped by category)',
  args: { tasks: duringCareTasks },
  play: async ({ canvas }) => {
    localStorage.removeItem('tasks-view')
    const cardBtn = canvas.getByLabelText('Card view')
    await userEvent.click(cardBtn)
    await expect(canvas.getByText('Insurance')).toBeVisible()
    await expect(canvas.getByText('Medication')).toBeVisible()
  },
}

export const ResolveFlow: Story = {
  name: 'Resolve flow — inline confirm',
  args: { tasks: duringCareTasks },
  play: async ({ canvas }) => {
    // Ensure list view is active regardless of localStorage state
    await userEvent.click(canvas.getByLabelText('List view'))
    const resolveBtn = canvas.getAllByRole('button', { name: 'Resolve' })[0]
    await userEvent.click(resolveBtn)
    await expect(canvas.getByText('Mark this task as done? This cannot be undone.')).toBeVisible()
    const confirmBtn = canvas.getByRole('button', { name: 'Mark as done' })
    await userEvent.click(confirmBtn)
  },
}

export const AllResolved: Story = {
  name: 'All tasks resolved — complete state',
  args: {
    tasks: duringCareTasks.map(t => ({ ...t, status: 'resolved' as const, resolved_at: '2026-06-10T09:00:00Z' })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('All tasks complete')).toBeVisible()
  },
}
