import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
import { getInviteByToken } from '@/lib/dal/invites'
import { getProfile } from '@/lib/dal/profiles'
import { getPatientAccess } from '@/lib/dal/patients'

type Props = {
  params: Promise<{ token: string }>
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params

  const invite = await getInviteByToken(token)

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
    const profile = await getProfile(user.id)

    // Coordinator: go to their view without touching the token
    if (profile?.role === 'coordinator') {
      redirect(`/dashboard/${invite.patient_id}`)
    }

    // Patient who already has access (reload case): redirect directly
    const existingAccess = await getPatientAccess(invite.patient_id)
    if (existingAccess) {
      redirect(`/patient/${invite.patient_id}`)
    }

    // Has a session but no access — check if token is still usable
    if (invite.used_at) {
      return <ErrorPage message="This invite link has already been used. Ask your coordinator to share a new one." />
    }

    // PIN-protected invite: logged-in users without existing access must still
    // verify the PIN. An anonymous session is not proof of identity.
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
