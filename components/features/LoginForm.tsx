'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoginSchema } from '@/lib/validation/schemas'
import type { AuthFormState } from '@/actions/auth'

type FieldErrors = Partial<Record<'email' | 'password', string>>

type LoginFormProps = {
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = LoginSchema.safeParse({ email, password })
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
          autoComplete="current-password"
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
        {isPending ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/register" className="text-brand-base underline-offset-4 hover:underline">
          Create your family account
        </Link>
      </p>
    </form>
  )
}
