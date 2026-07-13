'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type SelfRevokeResult = { ok: true } | { ok: false; error: string }

type SelfRevokeCoordinatorButtonProps = {
  patientName: string
  patientId: string
  onSelfRevoke: (patientId: string) => Promise<SelfRevokeResult>
}

type SelfRevokeState = {
  open: boolean
  loading: boolean
  error: string | null
}

export function SelfRevokeCoordinatorButton({ patientName, patientId, onSelfRevoke }: SelfRevokeCoordinatorButtonProps) {
  const [state, setState] = useState<SelfRevokeState>({ open: false, loading: false, error: null })

  async function handleLeave() {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await onSelfRevoke(patientId)
    if (!result.ok) {
      setState(s => ({ ...s, loading: false, error: result.error }))
    }
    // On success the caller no longer has access — the layout will redirect
    // them away on next navigation, so no local "done" state is needed here.
  }

  function handleOpenChange(open: boolean) {
    setState(s => ({ ...s, open, ...(open ? {} : { error: null }) }))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setState(s => ({ ...s, open: true }))}
      >
        <LogOut size={13} />
        Leave
      </Button>

      <Dialog open={state.open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop managing {patientName}&apos;s care?</DialogTitle>
            <DialogDescription>
              You will lose access to this record immediately. If you&apos;re the only coordinator, this isn&apos;t possible yet — there&apos;s no way to add another coordinator first.
            </DialogDescription>
          </DialogHeader>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setState(s => ({ ...s, open: false }))} disabled={state.loading}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleLeave} disabled={state.loading}>
              {state.loading ? <><Loader2 className="animate-spin" />Leaving…</> : 'Leave'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
