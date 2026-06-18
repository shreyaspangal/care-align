'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { CreatePatientState } from '@/actions/create-patient'
import { CreatePatientSchema } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FieldErrors = Partial<Record<'name' | 'dob' | 'gender' | 'admission_status', string>>

type Props = {
  onCreatePatient: (_prev: CreatePatientState, formData: FormData) => Promise<CreatePatientState>
}

export function CreatePatientForm({ onCreatePatient }: Props) {
  const [state, action, isPending] = useActionState(onCreatePatient, null)

  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [admissionStatus, setAdmissionStatus] = useState<'admitted' | 'outpatient'>('admitted')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = CreatePatientSchema.safeParse({
      name,
      dob,
      gender,
      admission_status: admissionStatus,
    })
    if (!result.success) {
      e.preventDefault()
      const errs: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (!errs[field]) errs[field] = issue.message
      }
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4 text-left">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Patient full name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Ramesh Sharma"
          value={name}
          onChange={(e) => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })) }}
          disabled={isPending}
          aria-invalid={!!fieldErrors.name}
          className="h-10"
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            name="dob"
            type="date"
            required
            value={dob}
            onChange={(e) => { setDob(e.target.value); setFieldErrors(p => ({ ...p, dob: undefined })) }}
            disabled={isPending}
            aria-invalid={!!fieldErrors.dob}
            className="h-10"
          />
          {fieldErrors.dob && (
            <p className="text-xs text-destructive">{fieldErrors.dob}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            required
            value={gender}
            onChange={(e) => { setGender(e.target.value); setFieldErrors(p => ({ ...p, gender: undefined })) }}
            disabled={isPending}
            aria-invalid={!!fieldErrors.gender}
            className={cn(
              'h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
              'transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
              fieldErrors.gender && 'border-destructive'
            )}
          >
            <option value="">Select…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {fieldErrors.gender && (
            <p className="text-xs text-destructive">{fieldErrors.gender}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Admission type</Label>
        <div className="grid grid-cols-2 gap-3">
          {(['admitted', 'outpatient'] as const).map((val) => (
            <label
              key={val}
              className={cn(
                'flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors',
                admissionStatus === val
                  ? 'border-primary bg-primary/5'
                  : 'border-input hover:border-primary/40',
                isPending && 'pointer-events-none opacity-50'
              )}
            >
              <input
                type="radio"
                name="admission_status"
                value={val}
                checked={admissionStatus === val}
                onChange={() => setAdmissionStatus(val)}
                disabled={isPending}
                className="accent-primary"
              />
              <span className="text-sm font-medium capitalize">{val}</span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full h-10" size="lg">
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Setting up…
          </>
        ) : (
          'Add patient & start episode'
        )}
      </Button>
    </form>
  )
}
