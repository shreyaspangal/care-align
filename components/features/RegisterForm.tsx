'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RegisterSchema } from '@/lib/validation/schemas'
import type { AuthFormState } from '@/actions/auth'

type FieldErrors = Partial<Record<'familyName' | 'email' | 'password', string>>

type RegisterFormProps = {
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>
}

export function RegisterForm({ action }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = RegisterSchema.safeParse({ familyName, email, password })
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
      {state?.message && (
        <p role="status" className="rounded-md bg-success-tint px-3 py-2 text-sm text-foreground">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="familyName">Family name</Label>
        <Input
          id="familyName"
          name="familyName"
          placeholder="e.g. The Sharmas"
          value={familyName}
          aria-invalid={!!fieldErrors.familyName}
          onChange={(e) => {
            setFamilyName(e.target.value)
            setFieldErrors((p) => ({ ...p, familyName: undefined }))
          }}
        />
        {fieldErrors.familyName && (
          <p className="text-xs text-destructive">{fieldErrors.familyName}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={!!fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value)
            setFieldErrors((p) => ({ ...p, email: undefined }))
          }}
        />
        {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          aria-invalid={!!fieldErrors.password}
          onChange={(e) => {
            setPassword(e.target.value)
            setFieldErrors((p) => ({ ...p, password: undefined }))
          }}
        />
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create family account'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-base underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  )
}
