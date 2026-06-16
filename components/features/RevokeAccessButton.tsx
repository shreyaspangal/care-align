'use client'

import { useState } from 'react'
import { ShieldOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type RevokeResult = { ok: true } | { ok: false; error: string }

type RevokeAccessButtonProps = {
  patientName: string
  patientId: string
  onRevoke: (patientId: string) => Promise<RevokeResult>
}

type RevokeState = {
  open: boolean
  loading: boolean
  error: string | null
  done: boolean
}

export function RevokeAccessButton({ patientName, patientId, onRevoke }: RevokeAccessButtonProps) {
  const [state, setState] = useState<RevokeState>({
    open: false,
    loading: false,
    error: null,
    done: false,
  })

  async function handleRevoke() {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await onRevoke(patientId)
    if (result.ok) {
      setState(s => ({ ...s, loading: false, done: true }))
    } else {
      setState(s => ({ ...s, loading: false, error: result.error }))
    }
  }

  function handleOpenChange(open: boolean) {
    setState(s => ({ ...s, open, ...(open ? {} : { error: null, done: false }) }))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setState(s => ({ ...s, open: true }))}
      >
        <ShieldOff size={13} />
        Revoke access
      </Button>

      <Dialog open={state.open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {patientName}&apos;s care access?</DialogTitle>
            <DialogDescription>
              This removes access for everyone who has previously redeemed an invite link.
              They will see a message asking them to contact you for a new link.
              Generate a new invite link after revoking to share with the right person.
            </DialogDescription>
          </DialogHeader>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          {state.done ? (
            <p className="text-sm text-success-base font-medium">Access revoked. Generate a new invite link to share.</p>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setState(s => ({ ...s, open: false }))} disabled={state.loading}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleRevoke} disabled={state.loading}>
                {state.loading ? <><Loader2 className="animate-spin" />Revoking…</> : 'Revoke access'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
