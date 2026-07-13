import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, expect } from 'storybook/test'
import { CreatePatientForm } from './CreatePatientForm'

const meta = {
  component: CreatePatientForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { onCreatePatient: fn() },
} satisfies Meta<typeof CreatePatientForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Patient full name')).toBeVisible()
    await expect(canvas.getByLabelText('Date of birth')).toBeVisible()
    await expect(canvas.getByLabelText('Gender')).toBeVisible()
    await expect(canvas.getByText('Admission type')).toBeVisible()
    await expect(canvas.getByText(/I confirm I have their authority/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: /add patient/i })).toBeVisible()
  },
}

export const AdmittedSelected: Story = {
  name: 'Admitted (default selection)',
  play: async ({ canvas }) => {
    const admitted = canvas.getByDisplayValue('admitted')
    await expect(admitted).toBeChecked()
    const outpatient = canvas.getByDisplayValue('outpatient')
    await expect(outpatient).not.toBeChecked()
  },
}
