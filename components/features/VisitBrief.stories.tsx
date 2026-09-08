import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { VisitBrief, type VisitBriefData } from './VisitBrief'

const full: VisitBriefData = {
  profile: {
    id: 'profile-1',
    name: 'Ramesh Pangal',
    dob: '1958-04-12',
    sex: 'male',
  },
  medications: [
    {
      name: 'Atorvastatin',
      strength: '10mg',
      frequency: 'once daily',
      form: 'tablet',
      sourceDocumentId: 'doc-1',
      sourceDocumentTitle: 'Lipid Profile — Apollo Clinic',
      sourceDocumentDate: '2026-03-12',
    },
    {
      name: 'Metformin',
      strength: '500mg',
      frequency: 'twice daily, after meals',
      form: 'tablet',
      sourceDocumentId: 'doc-2',
      sourceDocumentTitle: 'Prescription — Dr. Meera Nadkarni',
      sourceDocumentDate: '2026-06-02',
    },
  ],
  latestDocumentsByType: [
    { documentId: 'doc-2', docType: 'prescription', title: 'Prescription — Dr. Meera Nadkarni', documentDate: '2026-06-02' },
    { documentId: 'doc-1', docType: 'lab_report', title: 'Lipid Profile — Apollo Clinic', documentDate: '2026-03-12' },
    { documentId: 'doc-3', docType: 'imaging_report', title: 'Chest X-Ray', documentDate: '2025-11-20' },
  ],
  appointments: [
    {
      id: 'appt-1',
      title: 'Cardiology follow-up',
      doctorName: 'Dr. R. K. Sharma',
      facilityName: 'Apollo Clinic, Bangalore',
      scheduledAt: '2026-09-20T10:30:00Z',
      status: 'upcoming',
    },
    {
      id: 'appt-2',
      title: 'Annual checkup',
      doctorName: 'Dr. Meera Nadkarni',
      facilityName: 'Sunrise Family Clinic',
      scheduledAt: '2026-03-12T09:00:00Z',
      status: 'done',
    },
  ],
}

const meta = {
  title: 'Features/VisitBrief',
  component: VisitBrief,
  args: { brief: full },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VisitBrief>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {}

export const NewProfile: Story = {
  args: {
    brief: {
      profile: { id: 'profile-2', name: 'Baby Ananya', dob: '2026-01-15', sex: 'female' },
      medications: [],
      latestDocumentsByType: [],
      appointments: [],
    },
  },
}

export const NoAppointments: Story = {
  args: {
    brief: { ...full, appointments: [] },
  },
}
