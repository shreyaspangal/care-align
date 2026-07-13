'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreatePatientForm } from '@/components/features/CreatePatientForm'
import type { MyAccessListItem } from '@/lib/dal/patients'
import type { CreatePatientState } from '@/actions/create-patient'

type Props = {
  patients: MyAccessListItem[]
  onCreatePatient: (_prev: CreatePatientState, formData: FormData) => Promise<CreatePatientState>
}

export function DashboardContent({ patients, onCreatePatient }: Props) {
  const [query, setQuery] = useState('')

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
          <CreatePatientForm onCreatePatient={onCreatePatient} />
        </div>
      </div>
    )
  }

  const filtered = query.trim()
    ? patients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : patients

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Your people</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} linked {patients.length === 1 ? 'record' : 'records'}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="lg:hidden">
          <Link href="/dashboard/new">
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add patient
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search patients…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No patients match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="divide-y divide-border rounded-xl border bg-card">
          {filtered.map(patient => (
            <Link
              key={patient.id}
              href={`/dashboard/${patient.id}/summary`}
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
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {patient.role === 'coordinator' ? 'You manage' : 'Your care'}
                </Badge>
                <Badge variant={patient.admission_status === 'admitted' ? 'default' : 'secondary'}>
                  {patient.admission_status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
