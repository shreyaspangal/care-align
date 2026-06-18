'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { JoinState } from '@/actions/join-as-patient'

type PinEntryFormProps = {
  patientName: string
  onVerify: (_prev: JoinState, formData: FormData) => Promise<JoinState>
}

export function PinEntryForm({ patientName, onVerify }: PinEntryFormProps) {
  const [state, action, isPending] = useActionState(onVerify, null)

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-heading font-bold" style={{ letterSpacing: '-0.025em' }}>
          {patientName}&apos;s care has been shared with you.
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code your coordinator gave you to access your care documents.
        </p>
      </div>

      <form action={action} className="space-y-4">
        {state?.error && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pin">Access code</Label>
          <Input
            id="pin"
            name="pin"
            type="tel"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-12 text-center text-2xl font-mono tracking-[0.5em]"
          />
        </div>

        <Button type="submit" disabled={isPending} size="lg" className="w-full h-10">
          {isPending ? <><Loader2 className="animate-spin" />Verifying…</> : 'Access my care'}
        </Button>
      </form>
    </div>
  )
}
