'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChangePinSchema, RemovePinSchema } from '@/lib/validation/schemas'
import type { ProfileFormState } from '@/actions/profiles'

type VerifyWith = 'pin' | 'password'

type PinChangeFormProps = {
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  action: (prev: ProfileFormState, formData: FormData) => Promise<ProfileFormState>
  // 'change' asks for a new PIN; 'remove' only verifies. Both demand proof of
  // scope: the current PIN (profile-holder) or the account password
  // (account-holder / forgotten-PIN recovery) — SYSTEM_DESIGN §D.
  mode: 'change' | 'remove'
  submitLabel: string
}

type FieldErrors = Partial<Record<'currentPin' | 'accountPassword' | 'newPin', string>>

export function PinChangeForm({ action, mode, submitLabel }: PinChangeFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [verifyWith, setVerifyWith] = useState<VerifyWith>('pin')
  const [currentPin, setCurrentPin] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const idPrefix = `pin-${mode}`

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const schema = mode === 'change' ? ChangePinSchema : RemovePinSchema
    const result = schema.safeParse({
      verifyWith,
      currentPin: verifyWith === 'pin' ? currentPin : undefined,
      accountPassword: verifyWith === 'password' ? accountPassword : undefined,
      ...(mode === 'change' ? { newPin } : {}),
    })
    if (!result.success) {
      e.preventDefault()
      const next: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (field === 'currentPin' || field === 'accountPassword' || field === 'newPin') {
          next[field] ??= issue.message
        }
      }
      setErrors(next)
      return
    }
    setErrors({})
  }

  function switchVerification(next: VerifyWith) {
    setVerifyWith(next)
    setErrors((prev) => ({ ...prev, currentPin: undefined, accountPassword: undefined }))
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <input type="hidden" name="verifyWith" value={verifyWith} />

      {verifyWith === 'pin' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-current`}>Current PIN</Label>
          <Input
            id={`${idPrefix}-current`}
            name="currentPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className="text-center text-lg tracking-widest"
            value={currentPin}
            aria-invalid={!!errors.currentPin}
            onChange={(e) => {
              setCurrentPin(e.target.value.replace(/\D/g, ''))
              setErrors((prev) => ({ ...prev, currentPin: undefined }))
            }}
          />
          {errors.currentPin && <p className="text-xs text-destructive">{errors.currentPin}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-password`}>Account password</Label>
          <Input
            id={`${idPrefix}-password`}
            name="accountPassword"
            type="password"
            autoComplete="current-password"
            value={accountPassword}
            aria-invalid={!!errors.accountPassword}
            onChange={(e) => {
              setAccountPassword(e.target.value)
              setErrors((prev) => ({ ...prev, accountPassword: undefined }))
            }}
          />
          {errors.accountPassword && (
            <p className="text-xs text-destructive">{errors.accountPassword}</p>
          )}
        </div>
      )}

      {mode === 'change' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-new`}>New 4-digit PIN</Label>
          <Input
            id={`${idPrefix}-new`}
            name="newPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className="text-center text-lg tracking-widest"
            value={newPin}
            aria-invalid={!!errors.newPin}
            onChange={(e) => {
              setNewPin(e.target.value.replace(/\D/g, ''))
              setErrors((prev) => ({ ...prev, newPin: undefined }))
            }}
          />
          {errors.newPin && <p className="text-xs text-destructive">{errors.newPin}</p>}
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Checking…' : submitLabel}
      </Button>

      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto self-start p-0 text-xs text-muted-foreground"
        onClick={() => switchVerification(verifyWith === 'pin' ? 'password' : 'pin')}
      >
        {verifyWith === 'pin'
          ? 'Forgot the PIN? Verify with the account password'
          : 'Verify with the current PIN instead'}
      </Button>
    </form>
  )
}
