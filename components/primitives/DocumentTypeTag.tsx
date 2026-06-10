import { cn } from '@/lib/utils'

type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'discharge_summary'
  | 'bill'
  | 'observation_note'
  | 'other'

type DocumentTypeTagProps = {
  type: DocumentType
  size?: 'sm' | 'md'
}

const styles: Record<DocumentType, string> = {
  prescription: 'bg-blue-50 text-blue-700 border-blue-200',
  lab_report: 'bg-purple-50 text-purple-700 border-purple-200',
  discharge_summary: 'bg-green-50 text-green-700 border-green-200',
  bill: 'bg-amber-50 text-amber-700 border-amber-200',
  observation_note: 'bg-slate-50 text-slate-700 border-slate-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
}

const labels: Record<DocumentType, string> = {
  prescription: 'Prescription',
  lab_report: 'Lab Report',
  discharge_summary: 'Discharge Summary',
  bill: 'Bill',
  observation_note: 'Observation Note',
  other: 'Document',
}

export function DocumentTypeTag({ type, size = 'sm' }: DocumentTypeTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border rounded font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        styles[type]
      )}
    >
      {labels[type]}
    </span>
  )
}
