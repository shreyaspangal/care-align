'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ProfileSchema } from '@/lib/validation/schemas'
import { PROFILE_COLORS, SEXES, type ProfileColor, type Sex } from '@/lib/types/domain'
import type { ProfileFormState } from '@/actions/profiles'

type FieldErrors = Partial<Record<'name' | 'dob' | 'sex', string>>

const swatchClasses: Record<ProfileColor, string> = {
  accent: 'bg-accent-tint border-accent-base',
  brand: 'bg-brand-tint border-brand-base',
  ai: 'bg-ai-tint border-ai-base',
  success: 'bg-success-tint border-success-base',
}

const sexLabels: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
}

type ProfileFormProps = {
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>
  submitLabel: string
  defaults?: {
    name?: string
    dob?: string
    sex?: Sex
    color?: ProfileColor
  }
}

export function ProfileForm({ action, submitLabel, defaults }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [name, setName] = useState(defaults?.name ?? '')
  const [dob, setDob] = useState(defaults?.dob ?? '')
  const [sex, setSex] = useState<string>(defaults?.sex ?? '')
  const [color, setColor] = useState<ProfileColor>(defaults?.color ?? 'accent')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = ProfileSchema.safeParse({ name, dob, sex, color })
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
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          aria-invalid={!!fieldErrors.name}
          onChange={(e) => {
            setName(e.target.value)
            setFieldErrors((p) => ({ ...p, name: undefined }))
          }}
        />
        {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dob">Date of birth (optional)</Label>
        <Input
          id="dob"
          name="dob"
          type="date"
          value={dob}
          aria-invalid={!!fieldErrors.dob}
          onChange={(e) => {
            setDob(e.target.value)
            setFieldErrors((p) => ({ ...p, dob: undefined }))
          }}
        />
        {fieldErrors.dob && <p className="text-xs text-destructive">{fieldErrors.dob}</p>}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Sex (optional)</legend>
        <div className="flex gap-2" role="radiogroup">
          {SEXES.map((value) => (
            <label
              key={value}
              className={cn(
                'cursor-pointer rounded-md border px-3 py-1.5 text-sm',
                sex === value ? 'border-brand-base bg-brand-tint' : 'hover:bg-muted'
              )}
            >
              <input
                type="radio"
                name="sex"
                value={value}
                checked={sex === value}
                onChange={() => setSex(value)}
                className="sr-only"
              />
              {sexLabels[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Tile colour</legend>
        <div className="flex gap-2">
          {PROFILE_COLORS.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={value}
                checked={color === value}
                onChange={() => setColor(value)}
                className="sr-only"
              />
              <span
                aria-label={value}
                className={cn(
                  'block size-8 rounded-full border-2',
                  swatchClasses[value],
                  color === value ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
