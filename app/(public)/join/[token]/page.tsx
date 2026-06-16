import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  redeemToken,
  autoJoinAsPatient,
  verifyPinAndJoin,
  signInAndJoin,
  signUpAndJoin,
} from '@/actions/join-as-patient'
import { Logo } from '@/components/ui/logo'
import { AutoJoinForm } from './AutoJoinForm'
import { PinEntryForm } from './PinEntryForm'
import { JoinForm } from './JoinForm'

type Props = {
  params: Promise<{ token: string }>
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params
  const service = createServiceClient()

  const { data: invite } = await service
    .from('patient_invites')
    .select('id, patient_id, expires_at, used_at, pin_hash, pin_locked_at, patients(name)')
    .eq('token', token)
    .maybeSingle()

  // Universal guards (apply before any user check)
  if (!invite) {
    return <ErrorPage message="This invite link is invalid or has already been removed." />
  }
  if (new Date(invite.expires_at) < new Date()) {
    return <ErrorPage message="This invite link has expired. Ask your coordinator to share a new one." />
  }
  if (invite.pin_locked_at) {
    return <ErrorPage message="This access code has been locked after too many wrong attempts. Ask your coordinator to share a new link." />
  }

  const patientsField = invite.patients
  const patientName = (Array.isArray(patientsField) ? patientsField[0] : patientsField)?.name ?? 'Your care'

  // ── Logged-in user ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Coordinator: go to their view without touching the token
    if (profile?.role === 'coordinator') {
      redirect(`/dashboard/${invite.patient_id}`)
    }

    // Patient who already has access (reload case): redirect directly
    const { data: existingAccess } = await supabase
      .from('patient_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('patient_id', invite.patient_id)
      .eq('role', 'patient')
      .maybeSingle()

    if (existingAccess) {
      redirect(`/patient/${invite.patient_id}`)
    }

    // Has a session but no access — check if token is still usable
    if (invite.used_at) {
      return <ErrorPage message="This invite link has already been used. Ask your coordinator to share a new one." />
    }

    // PIN-protected invite: logged-in users without existing access must still
    // verify the PIN. An anonymous session is not proof of identity — the PIN
    // is the second factor that confirms the right person has the code.
    if (invite.pin_hash) {
      const boundVerify = verifyPinAndJoin.bind(null, token)
      return (
        <Shell>
          <PinEntryForm patientName={patientName} onVerify={boundVerify} />
        </Shell>
      )
    }

    // No PIN required — auto-redeem for the logged-in user
    const result = await redeemToken(token, user.id)
    if (!result.ok) return <ErrorPage message={result.error!} />
    redirect(`/patient/${result.patientId}`)
  }

  // ── Unauthenticated ─────────────────────────────────────────────────────────
  if (invite.used_at) {
    return <ErrorPage message="This invite link has already been used." />
  }

  // PIN required → show PIN entry form
  if (invite.pin_hash) {
    const boundVerify = verifyPinAndJoin.bind(null, token)
    return (
      <Shell>
        <PinEntryForm patientName={patientName} onVerify={boundVerify} />
      </Shell>
    )
  }

  // No PIN → frictionless anonymous access
  // AutoJoinForm auto-submits on mount; falls back to JoinForm if anonymous auth fails
  const boundAutoJoin = autoJoinAsPatient.bind(null, token)
  const boundSignIn   = signInAndJoin.bind(null, token)
  const boundSignUp   = signUpAndJoin.bind(null, token)

  return (
    <Shell>
      <AutoJoinForm
        patientName={patientName}
        onAutoJoin={boundAutoJoin}
        fallback={
          <JoinForm
            patientName={patientName}
            onSignIn={boundSignIn}
            onSignUp={boundSignUp}
          />
        }
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <Logo size="md" />
        {children}
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">
          If you think this is a mistake, ask your coordinator to share a new link.
        </p>
      </div>
    </Shell>
  )
}
