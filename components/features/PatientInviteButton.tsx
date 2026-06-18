'use client'

import { useState } from 'react'
import { Share2, Copy, Check, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateInviteResult } from '@/actions/create-invite'

type PatientInviteButtonProps = {
  patientId: string
  patientName: string
  onCreateInvite: (patientId: string, requirePin: boolean) => Promise<CreateInviteResult>
}

type DialogState = {
  open: boolean
  step: 'configure' | 'result'
  requirePin: boolean
  confirmed: boolean
  loading: boolean
  error: string | null
  url: string | null
  pin: string | null
}

type ClipboardState = {
  copiedUrl: boolean
  copiedPin: boolean
}

const INITIAL_DIALOG: DialogState = {
  open: false,
  step: 'configure',
  requirePin: true,
  confirmed: false,
  loading: false,
  error: null,
  url: null,
  pin: null,
}

export function PatientInviteButton({ patientId, patientName, onCreateInvite }: PatientInviteButtonProps) {
  const [dialog, setDialog]       = useState<DialogState>(INITIAL_DIALOG)
  const [clipboard, setClipboard] = useState<ClipboardState>({ copiedUrl: false, copiedPin: false })

  function handleOpen() {
    setDialog({ ...INITIAL_DIALOG, open: true })
  }

  function handleClose() {
    setDialog(d => ({ ...d, open: false }))
  }

  async function handleGenerate() {
    setDialog(d => ({ ...d, loading: true, error: null }))
    const result = await onCreateInvite(patientId, dialog.requirePin)
    if (!result.ok) {
      setDialog(d => ({ ...d, loading: false, error: result.error }))
      return
    }
    setDialog(d => ({ ...d, loading: false, step: 'result', url: result.url, pin: result.pin }))
  }

  async function copyUrl() {
    if (!dialog.url) return
    await navigator.clipboard.writeText(dialog.url)
    setClipboard({ copiedUrl: true, copiedPin: false })
    setTimeout(() => setClipboard(c => ({ ...c, copiedUrl: false })), 2000)
  }

  async function copyPin() {
    if (!dialog.pin) return
    await navigator.clipboard.writeText(dialog.pin)
    setClipboard({ copiedUrl: false, copiedPin: true })
    setTimeout(() => setClipboard(c => ({ ...c, copiedPin: false })), 2000)
  }

  const canGenerate = dialog.requirePin ? true : dialog.confirmed

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpen}>
        <Share2 size={13} />
        Share with patient
      </Button>

      <Dialog open={dialog.open} onOpenChange={open => setDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {patientName}&apos;s care</DialogTitle>
            <DialogDescription>
              {dialog.step === 'configure'
                ? 'Choose whether to require an access code before the patient can view their care.'
                : dialog.requirePin
                  ? 'Share the link via WhatsApp, then call the patient and tell them the code separately.'
                  : 'Anyone with this link can view care documents.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Step 1: Configure ── */}
          {dialog.step === 'configure' && (
            <div className="space-y-4">

              <div
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${dialog.requirePin ? 'border-brand-border bg-brand-tint' : 'border-border bg-card'}`}
                onClick={() => setDialog(d => ({ ...d, requirePin: true, confirmed: false }))}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className={dialog.requirePin ? 'text-brand-base mt-0.5' : 'text-muted-foreground mt-0.5'} />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${dialog.requirePin ? 'text-brand-base' : 'text-foreground'}`}>
                      Require access code <span className="text-xs font-normal opacity-60">(recommended)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A 6-digit code is generated alongside the link. Share the link via WhatsApp, tell the code over a phone call — only the right person gets in.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${!dialog.requirePin ? 'border-brand-border bg-brand-tint' : 'border-border bg-card opacity-60'}`}
                onClick={() => setDialog(d => ({ ...d, requirePin: false }))}
              >
                <div className="flex items-start gap-3">
                  <ShieldOff size={18} className={`mt-0.5 ${!dialog.requirePin ? 'text-brand-base' : 'text-muted-foreground'}`} />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${!dialog.requirePin ? 'text-brand-base' : 'text-foreground'}`}>Direct access — no code</p>
                    <p className="text-xs text-muted-foreground">
                      Anyone with the link can view care documents. Use only if sending directly to the patient&apos;s own device.
                    </p>
                  </div>
                </div>
              </div>

              {!dialog.requirePin && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dialog.confirmed}
                    onChange={e => setDialog(d => ({ ...d, confirmed: e.target.checked }))}
                    className="mt-0.5 accent-brand-base"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I understand that anyone who receives this link can view the patient&apos;s care documents.
                  </span>
                </label>
              )}

              {dialog.error && <p className="text-sm text-destructive">{dialog.error}</p>}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canGenerate || dialog.loading}
                  onClick={handleGenerate}
                >
                  {dialog.loading ? <><Loader2 className="animate-spin" />Generating…</> : 'Generate link'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Result ── */}
          {dialog.step === 'result' && dialog.url && (
            <div className="space-y-4">

              {dialog.pin && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Step 1 — Share this link via WhatsApp</Label>
                    <div className="flex gap-2">
                      <Input
                        value={dialog.url}
                        readOnly
                        className="h-9 text-xs font-mono text-muted-foreground"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <Button variant={clipboard.copiedUrl ? 'default' : 'outline'} size="sm" className="shrink-0 gap-1.5" onClick={copyUrl}>
                        {clipboard.copiedUrl ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Step 2 — Call the patient and tell them this code</Label>
                    <div className="flex gap-2">
                      <Input
                        value={dialog.pin}
                        readOnly
                        className="h-9 text-2xl font-mono tracking-[0.5em] text-center"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <Button variant={clipboard.copiedPin ? 'default' : 'outline'} size="sm" className="shrink-0 gap-1.5" onClick={copyPin}>
                        {clipboard.copiedPin ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 leading-relaxed">
                    This code won&apos;t be shown again — note it before closing. Generate a new link if it&apos;s lost.
                  </p>
                </>
              )}

              {!dialog.pin && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Share this link with the patient</Label>
                  <div className="flex gap-2">
                    <Input
                      value={dialog.url}
                      readOnly
                      className="h-9 text-xs font-mono text-muted-foreground"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <Button variant={clipboard.copiedUrl ? 'default' : 'outline'} size="sm" className="shrink-0 gap-1.5" onClick={copyUrl}>
                      {clipboard.copiedUrl ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
                    </Button>
                  </div>
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
