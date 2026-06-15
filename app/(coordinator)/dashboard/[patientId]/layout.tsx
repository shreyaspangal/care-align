import type { ReactNode } from 'react'
import { PatientTabNav } from '@/components/features/PatientTabNav'

type Props = {
  children: ReactNode
  params: Promise<{ patientId: string }>
}

export default async function PatientDetailLayout({ children, params }: Props) {
  const { patientId } = await params
  return (
    <>
      <div className="pb-20">{children}</div>
      <PatientTabNav patientId={patientId} />
    </>
  )
}
