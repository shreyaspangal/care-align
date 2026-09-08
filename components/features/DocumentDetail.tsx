import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DocumentDetail as DocumentDetailData } from '@/lib/dal/documents'
import { DOC_TYPE_LABELS, ViewFileLink } from './DocumentCard'

type DocumentDetailProps = {
  document: DocumentDetailData
}

// The "explain" half of "organize and explain" (CLAUDE.md — what we're
// building). Prior to this component, document_explanations was written by
// the AI pipeline and rendered on zero screens — this is the first surface
// that shows it.
export function DocumentDetail({ document }: DocumentDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-success-tint text-success-base">
              {document.docType ? DOC_TYPE_LABELS[document.docType] : 'Document'}
            </Badge>
          </div>
          <CardTitle>{document.title ?? 'Untitled document'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>{document.documentDate ?? 'Date unknown'}</span>
          {(document.doctorName || document.facilityName) && (
            <span>{[document.doctorName, document.facilityName].filter(Boolean).join(' — ')}</span>
          )}
          {document.patientNameAsWritten && <span>Patient: {document.patientNameAsWritten}</span>}
          <ViewFileLink documentId={document.id} />
        </CardContent>
      </Card>

      {!document.explanation ? (
        <p className="text-sm text-muted-foreground">
          {document.status === 'needs_review'
            ? "This document hasn't been organized yet — fix or retry it from the timeline."
            : 'Still organizing…'}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">What it says</h2>
            <p className="text-sm">{document.explanation.whatItSays}</p>
          </section>

          {document.explanation.terms.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Terms explained</h2>
              <p className="text-xs text-muted-foreground">
                General medical definitions — not an assessment of this specific result.
              </p>
              <dl className="flex flex-col gap-2">
                {document.explanation.terms.map((term, i) => (
                  <div key={i}>
                    <dt className="text-sm font-medium">{term.term}</dt>
                    <dd className="text-sm text-muted-foreground">{term.plain_explanation}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {document.explanation.medications.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Medications (as written)</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {document.explanation.medications.map((med, i) => (
                  <li key={i}>
                    {[med.name, med.strength, med.frequency, med.form].filter(Boolean).join(' · ')}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {document.explanation.tests.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Test results (as written)</h2>
              <p className="text-xs text-muted-foreground">
                Flags are copied exactly as printed on the document — CareAlign never generates
                or infers a flag.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pr-4 pb-2 font-medium">Test</th>
                      <th className="pr-4 pb-2 font-medium">Value</th>
                      <th className="pr-4 pb-2 font-medium">Reference range</th>
                      <th className="pb-2 font-medium">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.explanation.tests.map((test, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-4">{test.name}</td>
                        <td className="py-2 pr-4">
                          {[test.value, test.unit].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {test.reference_range ?? '—'}
                        </td>
                        <td className="py-2">{test.flag_as_written ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
