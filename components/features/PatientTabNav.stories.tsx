import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { PatientTabNav } from './PatientTabNav'

const meta = {
  component: PatientTabNav,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { patientId: 'patient-fixture-id' },
} satisfies Meta<typeof PatientTabNav>

export default meta
type Story = StoryObj<typeof meta>

export const DocumentsActive: Story = {
  name: 'Documents active (default)',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Documents')).toBeVisible()
    await expect(canvas.getByText('Summary')).toBeVisible()
    await expect(canvas.getByText('Tasks')).toBeVisible()
  },
}

export const SummaryActive: Story = {
  name: 'Summary active',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id/summary' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Summary')).toBeVisible()
  },
}

export const TasksActive: Story = {
  name: 'Tasks active',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id/tasks' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Tasks')).toBeVisible()
  },
}
