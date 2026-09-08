import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { DocumentDetail } from './DocumentDetail'
import type { DocumentDetail as DocumentDetailData } from '@/lib/dal/documents'

const base: DocumentDetailData = {
  id: 'doc-1',
  status: 'organized',
  docType: 'lab_report',
  title: 'Lipid Profile',
  titleIsGuessed: false,
  documentDate: '2026-03-12',
  doctorName: 'Dr. R. K. Sharma, MD',
  facilityName: 'Apollo Clinic, Bangalore',
  capturedAt: '2026-03-12T12:00:00Z',
  profileId: 'profile-1',
  patientNameAsWritten: 'Ramesh Pangal',
  explanation: {
    whatItSays:
      'This report shows results from a lipid profile blood test, which measures different types of fat in the blood.',
    terms: [
      {
        term: 'LDL',
        plain_explanation:
          'Low-density lipoprotein — a type of cholesterol sometimes called "bad cholesterol."',
      },
      {
        term: 'HDL',
        plain_explanation:
          'High-density lipoprotein — a type of cholesterol sometimes called "good cholesterol."',
      },
    ],
    medications: [
      { name: 'Atorvastatin', strength: '10mg', frequency: 'once daily', form: 'tablet' },
    ],
    tests: [
      {
        name: 'LDL Cholesterol',
        value: '142',
        unit: 'mg/dL',
        reference_range: '<100',
        flag_as_written: 'HIGH',
      },
      {
        name: 'HDL Cholesterol',
        value: '48',
        unit: 'mg/dL',
        reference_range: '>40',
        flag_as_written: null,
      },
    ],
  },
}

const meta = {
  title: 'Features/DocumentDetail',
  component: DocumentDetail,
  // DeleteDocumentButton uses next/navigation's useRouter (Next 16 App
  // Router) — required whenever a story renders a component that does.
  parameters: {
    nextjs: { appDirectory: true },
  },
  args: {
    document: base,
    deleteDocument: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentDetail>

export default meta
type Story = StoryObj<typeof meta>

export const Organized: Story = {}

export const NoTermsOrMedications: Story = {
  args: {
    document: {
      ...base,
      title: 'Doctor visit note',
      docType: 'doctor_note',
      explanation: {
        whatItSays: 'This is a note from a routine doctor visit.',
        terms: [],
        medications: [],
        tests: [],
      },
    },
  },
}

export const NeedsReview: Story = {
  args: {
    document: { ...base, status: 'needs_review', explanation: null },
  },
}

export const StillOrganizing: Story = {
  args: {
    document: { ...base, status: 'uploaded', explanation: null },
  },
}
