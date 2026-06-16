'use client'

import { useState, useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { JoinState } from '@/actions/join-as-patient'

type JoinFormProps = {
  patientName: string
  onSignIn: (_prev: JoinState, formData: FormData) => Promise<JoinState>
  onSignUp: (_prev: JoinState, formData: FormData) => Promise<JoinState>
}

export function JoinForm({ patientName, onSignIn, onSignUp }: JoinFormProps) {
  const [tab, setTab] = useState<'signup' | 'signin'>('signup')

  const [signUpState, signUpAction, signUpPending] = useActionState(onSignUp, null)
  const [signInState, signInAction, signInPending] = useActionState(onSignIn, null)

  const error = tab === 'signup' ? signUpState?.error : signInState?.error
  const isPending = tab === 'signup' ? signUpPending : signInPending

  return (
    <div className="w-full max-w-sm space-y-6">

      {/* Context */}
      <div className="space-y-1.5">
        <h1 className="text-xl font-heading font-bold tracking-tight" style={{ letterSpacing: '-0.025em' }}>
          {patientName}&apos;s care has been shared with you.
        </h1>
        <p className="text-sm text-muted-foreground">
          {tab === 'signup'
            ? 'Create an account to view your care documents and stay informed.'
            : 'Sign in to your existing account to access your care.'}
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted text-sm">
        <Button
          type="button"
          variant={tab === 'signup' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setTab('signup')}
        >
          Create account
        </Button>
        <Button
          type="button"
          variant={tab === 'signin' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setTab('signin')}
        >
          Sign in
        </Button>
      </div>

      {/* Sign-up form */}
      {tab === 'signup' && (
        <form action={signUpAction} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name-signup">Your name</Label>
            <Input id="name-signup" name="name" type="text" required autoComplete="name" placeholder="Ramesh Sharma" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-signup">Email</Label>
            <Input id="email-signup" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-signup">Password</Label>
            <Input id="password-signup" name="password" type="password" required autoComplete="new-password" placeholder="••••••••" minLength={8} className="h-10" />
            <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>
          <Button type="submit" disabled={isPending} className="w-full h-10" size="lg">
            {isPending ? <><Loader2 className="animate-spin" />Creating account…</> : 'Create account and view care'}
          </Button>
        </form>
      )}

      {/* Sign-in form */}
      {tab === 'signin' && (
        <form action={signInAction} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email-signin">Email</Label>
            <Input id="email-signin" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-signin">Password</Label>
            <Input id="password-signin" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="h-10" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full h-10" size="lg">
            {isPending ? <><Loader2 className="animate-spin" />Signing in…</> : 'Sign in and view care'}
          </Button>
        </form>
      )}
    </div>
  )
}
