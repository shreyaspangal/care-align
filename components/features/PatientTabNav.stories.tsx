import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { PatientTabNav } from './PatientTabNav'

const meta = {
  component: PatientTabNav,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { patientId: 'patient-fixture-id', role: 'coordinator' },
} satisfies Meta<typeof PatientTabNav>

export default meta
type Story = StoryObj<typeof meta>

export const CoordinatorDocumentsActive: Story = {
  name: 'Coordinator — Documents active (default)',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Documents')).toBeVisible()
    await expect(canvas.getByText('Summary')).toBeVisible()
    await expect(canvas.getByText('Tasks')).toBeVisible()
    await expect(canvas.queryByText('Access')).not.toBeInTheDocument()
  },
}

export const CoordinatorSummaryActive: Story = {
  name: 'Coordinator — Summary active',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id/summary' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Summary')).toBeVisible()
  },
}

export const CoordinatorTasksActive: Story = {
  name: 'Coordinator — Tasks active',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id/tasks' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Tasks')).toBeVisible()
  },
}

export const PatientDocumentsActive: Story = {
  name: 'Patient — Documents active',
  args: { role: 'patient' },
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Documents')).toBeVisible()
    await expect(canvas.getByText('Summary')).toBeVisible()
    await expect(canvas.getByText('Access')).toBeVisible()
    await expect(canvas.queryByText('Tasks')).not.toBeInTheDocument()
  },
}

export const PatientAccessActive: Story = {
  name: 'Patient — Access active',
  args: { role: 'patient' },
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-fixture-id/access' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Access')).toBeVisible()
  },
}
