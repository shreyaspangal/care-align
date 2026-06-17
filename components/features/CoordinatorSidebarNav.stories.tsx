import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect } from 'storybook/test'
import { CoordinatorSidebarNav } from './CoordinatorSidebarNav'

const PATIENTS = [
  { id: 'patient-001', name: 'Ramesh Sharma', admission_status: 'admitted',  date_of_birth: '1958-03-12', pinned_at: null },
  { id: 'patient-002', name: 'Priya Nair',    admission_status: 'outpatient', date_of_birth: '1985-07-22', pinned_at: null },
]

const meta = {
  component: CoordinatorSidebarNav,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { onTogglePin: fn() },
} satisfies Meta<typeof CoordinatorSidebarNav>

export default meta
type Story = StoryObj<typeof meta>

export const NoActivePatient: Story = {
  name: 'No active patient',
  parameters: { nextjs: { navigation: { pathname: '/dashboard' } } },
  args: { patients: PATIENTS },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ramesh Sharma')).toBeVisible()
    await expect(canvas.getByText('Priya Nair')).toBeVisible()
    await expect(canvas.getByText('Add patient')).toBeVisible()
  },
}

export const WithActivePatient: Story = {
  name: 'Active patient highlighted',
  parameters: { nextjs: { navigation: { pathname: '/dashboard/patient-001' } } },
  args: { patients: PATIENTS },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ramesh Sharma')).toBeVisible()
    await expect(canvas.getByText('Priya Nair')).toBeVisible()
  },
}

export const EmptyList: Story = {
  name: 'No patients yet',
  parameters: { nextjs: { navigation: { pathname: '/dashboard' } } },
  args: { patients: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No active patients.')).toBeVisible()
    await expect(canvas.getByText('Add patient')).toBeVisible()
  },
}
