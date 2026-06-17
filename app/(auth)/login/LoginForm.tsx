'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { AuthState } from '@/actions/auth'
import { LoginSchema } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldErrors = Partial<Record<'email' | 'password', string>>

type Props = {
  onLogin: (_prev: AuthState, formData: FormData) => Promise<AuthState>
}

export function LoginForm({ onLogin }: Props) {
  const [state, action, isPending] = useActionState(onLogin, null)
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
    <div className="w-full max-w-sm space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-heading font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>
          Welcome back.
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue managing care.
        </p>
      </div>

      <form action={action} onSubmit={handleSubmit} className="space-y-4">
        {state?.error && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })) }}
            disabled={isPending}
            aria-invalid={!!fieldErrors.email}
            className="h-10"
          />
          {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })) }}
            disabled={isPending}
            aria-invalid={!!fieldErrors.password}
            className="h-10"
          />
          {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-10" size="lg">
          {isPending ? <><Loader2 className="animate-spin" />Signing in…</> : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to CareAlign?{' '}
        <Link href="/register" className="text-brand-base font-medium hover:underline underline-offset-4">
          Get started
        </Link>
      </p>
    </div>
  )
}
