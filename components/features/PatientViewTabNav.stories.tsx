import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatientViewTabNav } from './PatientViewTabNav'

const meta = {
  component: PatientViewTabNav,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    patientId: 'patient-fixture-id',
  },
} satisfies Meta<typeof PatientViewTabNav>

export default meta
type Story = StoryObj<typeof meta>

export const DocumentsActive: Story = {}

export const SummaryActive: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/patient/patient-fixture-id/summary' } },
  },
}
