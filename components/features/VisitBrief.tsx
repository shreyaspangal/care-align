import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AppointmentStatus, DocType, Medication, Sex } from '@/lib/types/domain'
import { DOC_TYPE_LABELS } from './DocumentCard'

// The "last moment" this whole product exists for (docs/BUILD_PLAN.md Phase 4,
// DESIGN_REVIEW_LENS "design the last moment first"): what a family hands a
// doctor, or reads off their own phone, at the visit itself. Mocked here with
// realistic-shape data ahead of the real DAL wiring (Phase 4) — the timeline
// exists to feed this, not the other way around.
//
// Print-friendly and printer-legible in mind throughout: no color carries
// meaning here that a black-and-white printout would lose (DESIGN.md's
// No-Severity Rule already forbids color-as-clinical-signal, so this falls
// out for free), and the "Print this brief" action hides itself in print.

export type VisitBriefMedication = Medication & {
  sourceDocumentId: string
  sourceDocumentTitle: string | null
  sourceDocumentDate: string | null
}

export type VisitBriefLatestDocument = {
  documentId: string
  docType: DocType
  title: string | null
  documentDate: string | null
}

export type VisitBriefAppointment = {
  id: string
  title: string
  doctorName: string | null
  facilityName: string | null
  scheduledAt: string
  status: AppointmentStatus
}

export type VisitBriefData = {
  profile: {
    id: string
    name: string
    dob: string | null
    sex: Sex | null
  }
  medications: VisitBriefMedication[]
  latestDocumentsByType: VisitBriefLatestDocument[]
  appointments: VisitBriefAppointment[]
}

type VisitBriefProps = {
  brief: VisitBriefData
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Date unknown'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAge(dob: string | null): string | null {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
  return `${years} yrs`
}

export function VisitBrief({ brief }: VisitBriefProps) {
  const age = formatAge(brief.profile.dob)
  const upcoming = brief.appointments.filter((a) => a.status === 'upcoming')
  const past = brief.appointments.filter((a) => a.status !== 'upcoming')

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-semibold">{brief.profile.name}&apos;s visit brief</h1>
          <p className="text-sm text-muted-foreground">
            Everything a doctor might ask for, on one page.
          </p>
        </div>
        <Button onClick={() => window.print()}>Print this brief</Button>
      </div>

      {/* Print-only header — the screen header above has a subtitle and a
          button that don't belong on paper; this is the one that prints. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">{brief.profile.name}&apos;s visit brief</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{brief.profile.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          {(age || brief.profile.sex) && (
            <span>{[age, brief.profile.sex].filter(Boolean).join(' · ')}</span>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Current medications</h2>
        <p className="text-xs text-muted-foreground">
          As written on the most recent prescription that mentions each — not a dose log, not a
          reminder.
        </p>
        {brief.medications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medications on file yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {brief.medications.map((med, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">
                  {[med.name, med.strength, med.frequency, med.form].filter(Boolean).join(' · ')}
                </span>
                {med.sourceDocumentTitle && (
                  <Link
                    href={`/p/${brief.profile.id}/d/${med.sourceDocumentId}`}
                    className="block text-xs text-accent-base underline-offset-4 hover:underline print:text-muted-foreground print:no-underline"
                  >
                    from {med.sourceDocumentTitle}
                    {med.sourceDocumentDate ? ` — ${formatDate(med.sourceDocumentDate)}` : ''}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Latest by document type</h2>
        {brief.latestDocumentsByType.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents captured yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {brief.latestDocumentsByType.map((doc) => (
              <li key={doc.documentId} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{DOC_TYPE_LABELS[doc.docType]}</span>
                <Link
                  href={`/p/${brief.profile.id}/d/${doc.documentId}`}
                  className="text-right text-accent-base underline-offset-4 hover:underline print:text-foreground print:no-underline"
                >
                  {doc.title ?? 'Untitled document'} — {formatDate(doc.documentDate)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Appointments</h2>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments on file yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...upcoming, ...past].map((appt) => (
              <li key={appt.id} className="text-sm">
                <span className="font-medium">{appt.title}</span>
                {appt.status === 'upcoming' && (
                  <span className="ml-2 text-xs text-ai-base print:text-muted-foreground">
                    upcoming
                  </span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {formatDate(appt.scheduledAt)}
                  {(appt.doctorName || appt.facilityName) &&
                    ` — ${[appt.doctorName, appt.facilityName].filter(Boolean).join(', ')}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
