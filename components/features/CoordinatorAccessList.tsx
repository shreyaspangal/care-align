'use client'

import { useState } from 'react'
import { ShieldOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { PatientCoordinator } from '@/lib/dal/patients'

type RevokeResult = { ok: true } | { ok: false; error: string }

type CoordinatorAccessListProps = {
  patientId: string
  coordinators: PatientCoordinator[]
  onRevoke: (patientId: string, coordinatorUserId: string) => Promise<RevokeResult>
}

const PROVENANCE_LABEL: Record<PatientCoordinator['provenance'], string> = {
  coordinator_attested: 'Added you before you could sign in yourself',
  self_consented: 'Joined with your consent',
}

export function CoordinatorAccessList({ patientId, coordinators, onRevoke }: CoordinatorAccessListProps) {
  if (coordinators.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nobody currently has coordinator access to this record.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border rounded-xl border bg-card">
      {coordinators.map(coordinator => (
        <CoordinatorRow
          key={coordinator.userId}
          patientId={patientId}
          coordinator={coordinator}
          onRevoke={onRevoke}
        />
      ))}
    </div>
  )
}

type CoordinatorRowProps = {
  patientId: string
  coordinator: PatientCoordinator
  onRevoke: (patientId: string, coordinatorUserId: string) => Promise<RevokeResult>
}

type RevokeState = { open: boolean; loading: boolean; error: string | null; done: boolean }

function CoordinatorRow({ patientId, coordinator, onRevoke }: CoordinatorRowProps) {
  const [state, setState] = useState<RevokeState>({ open: false, loading: false, error: null, done: false })

  async function handleRevoke() {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await onRevoke(patientId, coordinator.userId)
    if (result.ok) {
      setState(s => ({ ...s, loading: false, done: true }))
    } else {
      setState(s => ({ ...s, loading: false, error: result.error }))
    }
  }

  function handleOpenChange(open: boolean) {
    setState(s => ({ ...s, open, ...(open ? {} : { error: null }) }))
  }

  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{coordinator.name ?? 'Unknown'}</p>
        <p className="text-xs text-muted-foreground">{PROVENANCE_LABEL[coordinator.provenance]}</p>
      </div>

      {state.done ? (
        <Badge variant="outline">Revoked</Badge>
      ) : (
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
                <DialogTitle>Revoke {coordinator.name ?? 'this coordinator'}&apos;s access?</DialogTitle>
                <DialogDescription>
                  They will no longer be able to view or manage your care documents. You can share a new invite link later if you change your mind.
                </DialogDescription>
              </DialogHeader>

              {state.error && <p className="text-sm text-destructive">{state.error}</p>}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setState(s => ({ ...s, open: false }))} disabled={state.loading}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleRevoke} disabled={state.loading}>
                  {state.loading ? <><Loader2 className="animate-spin" />Revoking…</> : 'Revoke access'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
