'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { register } from '@/actions/auth'
import { RegisterSchema } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'role', string>>

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(register, null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'coordinator' | 'patient'>('coordinator')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const result = RegisterSchema.safeParse({ name, email, password, role })
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Join CareAlign to manage patient care
          </p>
        </div>

        <form action={action} onSubmit={handleSubmit} className="space-y-4">
          {state?.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Rahul Sharma"
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
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })) }}
              disabled={isPending}
              aria-invalid={!!fieldErrors.password}
              className="h-10"
            />
            {fieldErrors.password
              ? <p className="text-xs text-destructive">{fieldErrors.password}</p>
              : <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            }
          </div>

          <div className="space-y-1.5">
            <Label>I am signing up as</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['coordinator', 'patient'] as const).map((r) => (
                <label
                  key={r}
                  className={cn(
                    'flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors',
                    role === r
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/40',
                    isPending && 'pointer-events-none opacity-50'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => { setRole(r); setFieldErrors(p => ({ ...p, role: undefined })) }}
                    disabled={isPending}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium capitalize">{r}</span>
                </label>
              ))}
            </div>
            {fieldErrors.role && (
              <p className="text-xs text-destructive">{fieldErrors.role}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full h-10" size="lg">
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
