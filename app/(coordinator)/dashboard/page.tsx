import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorPatients } from '@/lib/dal/patients'
import { CreatePatientForm } from '@/components/features/CreatePatientForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

export default async function DashboardIndexPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Cached — deduplicates with the layout's call for the same userId
  const patients = await getCoordinatorPatients(user.id)

  if (patients.length === 0) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Add your first patient</h1>
            <p className="text-sm text-muted-foreground">
              Enter the patient&apos;s details to start managing their care documents.
            </p>
          </div>
          <CreatePatientForm />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your patients</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} {patients.length === 1 ? 'patient' : 'patients'} under your care
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="lg:hidden">
          <Link href="/dashboard/new">
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add patient
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-border rounded-xl border bg-card">
        {patients.map(patient => (
          <Link
            key={patient.id}
            href={`/dashboard/${patient.id}`}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{patient.name}</p>
              <p className="text-xs text-muted-foreground">
                DOB {new Date(patient.date_of_birth).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
            <Badge variant={patient.admission_status === 'admitted' ? 'default' : 'secondary'}>
              {patient.admission_status}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}
