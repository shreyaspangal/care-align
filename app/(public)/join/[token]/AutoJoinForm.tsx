'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JoinState } from '@/actions/join-as-patient'

type AutoJoinFormProps = {
  patientName: string
  onAutoJoin: (_prev: JoinState, formData: FormData) => Promise<JoinState>
  fallback: React.ReactNode
}

export function AutoJoinForm({ patientName, onAutoJoin, fallback }: AutoJoinFormProps) {
  const [state, action, isPending] = useActionState(onAutoJoin, null)
  const formRef = useRef<HTMLFormElement>(null)

  // Auto-submit on mount — the token IS the auth, no input needed
  useEffect(() => {
    formRef.current?.requestSubmit()
  }, [])

  // If anonymous auth failed (e.g. disabled in Supabase), show the manual form
  if (state?.error) return <>{fallback}</>

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-xl font-heading font-bold" style={{ letterSpacing: '-0.025em' }}>
          {patientName}&apos;s care has been shared with you.
        </h1>
      </div>

      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 size={15} className="animate-spin shrink-0" />
        Setting up your access…
      </div>

      {/* Hidden form — auto-submits on mount, never shown unless retrying */}
      <form ref={formRef} action={action} className="hidden">
        <Button type="submit" disabled={isPending}>Retry</Button>
      </form>
    </div>
  )
}
