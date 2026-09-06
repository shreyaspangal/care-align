'use client'

import { useActionState, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DOC_TYPES } from '@/lib/types/domain'
import type { DocumentSummary } from '@/lib/dal/documents'
import type { DocumentActionResult } from '@/actions/documents'

const DOC_TYPE_LABELS: Record<(typeof DOC_TYPES)[number], string> = {
  prescription: 'Prescription',
  lab_report: 'Lab report',
  imaging_report: 'Imaging report',
  discharge_summary: 'Discharge summary',
  vaccination_record: 'Vaccination record',
  doctor_note: "Doctor's note",
  bill: 'Bill',
  other: 'Other',
}

type DocumentCardProps = {
  document: DocumentSummary
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  retryOrganize: (documentId: string) => Promise<DocumentActionResult>
  updateDocumentDetails: (input: {
    documentId: string
    docType: (typeof DOC_TYPES)[number]
    title: string
    documentDate: string | null
    doctorName: string | null
    facilityName: string | null
  }) => Promise<DocumentActionResult>
}

export function DocumentCard({ document, retryOrganize, updateDocumentDetails }: DocumentCardProps) {
  if (document.status === 'uploaded') {
    return <OrganizingCard />
  }
  if (document.status === 'needs_review') {
    return (
      <NeedsReviewCard
        document={document}
        retryOrganize={retryOrganize}
        updateDocumentDetails={updateDocumentDetails}
      />
    )
  }
  return <OrganizedCard document={document} />
}

function OrganizingCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-ai-tint text-ai-base">Organizing…</Badge>
        </div>
        <Skeleton className="mt-2 h-5 w-2/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  )
}

function OrganizedCard({ document }: { document: DocumentSummary }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-success-tint text-success-base">
            {document.docType ? DOC_TYPE_LABELS[document.docType] : 'Organized'}
          </Badge>
        </div>
        <CardTitle>{document.title ?? 'Untitled document'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span>{document.documentDate ?? 'Date unknown'}</span>
        {(document.doctorName || document.facilityName) && (
          <span>{[document.doctorName, document.facilityName].filter(Boolean).join(' — ')}</span>
        )}
      </CardContent>
    </Card>
  )
}

function NeedsReviewCard({
  document,
  retryOrganize,
  updateDocumentDetails,
}: {
  document: DocumentSummary
  retryOrganize: (documentId: string) => Promise<DocumentActionResult>
  updateDocumentDetails: DocumentCardProps['updateDocumentDetails']
}) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>(document.docType ?? 'other')
  const [title, setTitle] = useState(document.title ?? '')
  const [documentDate, setDocumentDate] = useState(document.documentDate ?? '')
  const [doctorName, setDoctorName] = useState(document.doctorName ?? '')
  const [facilityName, setFacilityName] = useState(document.facilityName ?? '')

  async function handleRetry() {
    setIsRetrying(true)
    const result = await retryOrganize(document.id)
    if (!result.success) {
      toast.error(result.error)
    }
    setIsRetrying(false)
  }

  const [state, formAction, isSaving] = useActionState(
    async (_prev: DocumentActionResult | undefined) => {
      const result = await updateDocumentDetails({
        documentId: document.id,
        docType,
        title,
        documentDate: documentDate || null,
        doctorName: doctorName || null,
        facilityName: facilityName || null,
      })
      if (result.success) {
        toast.success('Details saved')
      }
      return result
    },
    undefined
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">Needs review</Badge>
          <Button variant="ghost" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? 'Retrying…' : 'Retry AI'}
          </Button>
        </div>
        <CardTitle>We couldn&apos;t organize this one automatically</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          {state?.success === false && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`title-${document.id}`}>Title</Label>
            <Input
              id={`title-${document.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`docType-${document.id}`}>Document type</Label>
            <select
              id={`docType-${document.id}`}
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {DOC_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DOC_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`date-${document.id}`}>Document date (optional)</Label>
            <Input
              id={`date-${document.id}`}
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`doctor-${document.id}`}>Doctor (optional)</Label>
            <Input
              id={`doctor-${document.id}`}
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`facility-${document.id}`}>Facility (optional)</Label>
            <Input
              id={`facility-${document.id}`}
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
            />
          </div>
          <CardFooter className="px-0 pb-0">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save details'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}
