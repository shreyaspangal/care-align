'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PinSchema } from '@/lib/validation/schemas'
import type { ProfileFormState } from '@/actions/profiles'

type PinFormProps = {
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>
  label: string
  submitLabel: string
}

export function PinForm({ action, label, submitLabel }: PinFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | undefined>(undefined)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = PinSchema.safeParse({ pin })
    if (!result.success) {
      e.preventDefault()
      setPinError(result.error.issues[0].message)
      return
    }
    setPinError(undefined)
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pin">{label}</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          className="text-center text-lg tracking-widest"
          value={pin}
          aria-invalid={!!pinError}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''))
            setPinError(undefined)
          }}
        />
        {pinError && <p className="text-xs text-destructive">{pinError}</p>}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Checking…' : submitLabel}
      </Button>
    </form>
  )
}
