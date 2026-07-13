'use server'

import { redirect } from 'next/navigation'
import { compare } from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LoginSchema, RegisterSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('join-as-patient')

const MAX_PIN_ATTEMPTS = 5

export type JoinState = { error: string } | null

// ── Core redemption — shared by all three join paths ─────────────────────────
//
// IMPORTANT: This function assumes the calling action has already authenticated
// the user and obtained their userId. It handles:
//   - Invite validity checks (not null, not expired, not used)
//   - Issue 8: coordinator guard — a coordinator cannot redeem an invite for
//     a patient they manage; the invite flow is for patients only
//   - Issue 6 (TOCTOU): the mark-as-used is an atomic UPDATE with a
//     WHERE used_at IS NULL guard; if two requests race, only one wins
//   - Issue 2: patient_access creation failure triggers a rollback of the mark
//     so the token stays redeemable and the user can retry
//
// NOTE: this function is called immediately after auth.signUp(). Email
// confirmation is disabled in this project, so signUp() always creates an
// immediate session — getUser() will return the user before this is called.

export async function redeemToken(
  token: string,
  userId: string,
): Promise<{ ok: boolean; patientId?: string; error?: string }> {
  const service = createServiceClient()

  // ── 1. Fetch the invite ───────────────────────────────────────────────────
  const { data: invite } = await service
    .from('patient_invites')
    .select('id, patient_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return { ok: false, error: 'This invite link is invalid.' }
  if (invite.used_at) return { ok: false, error: 'This invite link has already been used.' }
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, error: 'This invite link has expired. Ask your coordinator to share a new one.' }
  }

  // ── 2. Coordinator guard (Issue 8) ────────────────────────────────────────
  // A coordinator who manages this patient cannot use the patient invite link.
  // Without this check, clicking their own invite would create a second
  // patient_access row (role='patient') alongside their existing coordinator row.
  const { data: existingCoordinatorAccess } = await service
    .from('patient_access')
    .select('id')
    .eq('user_id', userId)
    .eq('patient_id', invite.patient_id)
    .eq('role', 'coordinator')
    .maybeSingle()

  if (existingCoordinatorAccess) {
    log.warn('join', 'coordinator attempted to redeem patient invite', { userId, patientId: invite.patient_id })
    return {
      ok: false,
      error: 'You are already managing this patient as a coordinator. This invite link is for the patient only.',
    }
  }

  // ── 3. Atomic mark-as-used (Issue 6 — TOCTOU fix) ────────────────────────
  // The WHERE used_at IS NULL guard means only one concurrent request can win.
  // If the UPDATE affects 0 rows, another request redeemed the token first.
  const { data: marked, error: markError } = await service
    .from('patient_invites')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (markError || !marked) {
    log.warn('join', 'atomic mark failed — concurrent redemption or DB error', {
      token: token.slice(0, 8),
      error: markError?.message,
    })
    return { ok: false, error: 'This invite link was just used. Ask your coordinator for a new one.' }
  }

  // ── 4. Create patient_access (Issue 2 — rollback on failure) ─────────────
  const { data: existing } = await service
    .from('patient_access')
    .select('id')
    .eq('user_id', userId)
    .eq('patient_id', invite.patient_id)
    .maybeSingle()

  if (!existing) {
    // provenance is 'self_consented': the patient is redeeming this invite
    // themselves — invite_id preserves the link back to who created it
    // (patient_invites.created_by) for the "who has access" provenance label.
    const { error: accessError } = await service
      .from('patient_access')
      .insert({ user_id: userId, patient_id: invite.patient_id, role: 'patient', provenance: 'self_consented', invite_id: invite.id })

    if (accessError) {
      log.error('join', 'patient_access insert failed — rolling back token mark', {
        userId,
        error: accessError.message,
      })
      // Roll back the used_at mark so the user can retry
      await service
        .from('patient_invites')
        .update({ used_at: null, used_by: null })
        .eq('id', invite.id)
      return { ok: false, error: 'Could not complete access. Please try again.' }
    }
  }

  log.info('join', 'invite redeemed successfully', { userId, patientId: invite.patient_id })
  return { ok: true, patientId: invite.patient_id }
}

// ── Anonymous sign-in + redeem (no-PIN direct access path) ──────────────────
// Used when the coordinator disables PIN requirement.
// Anonymous session persists in browser cookies on the same device.
// Requires "Anonymous sign-ins" enabled in Supabase Auth settings.

export async function autoJoinAsPatient(
  token: string,
  _prev: JoinState,
  _formData: FormData,
): Promise<JoinState> {
  const supabase = await createClient()

  const { data: { user }, error: signInError } = await supabase.auth.signInAnonymously({
    options: { data: { role: 'patient' } },
  })

  if (signInError || !user) {
    log.error('join-auto', 'anonymous sign-in failed', { message: signInError?.message })
    return { error: 'Could not set up access. Please try again.' }
  }

  const result = await redeemToken(token, user.id)
  if (!result.ok) return { error: result.error! }

  redirect(`/dashboard/${result.patientId}`)
}

// ── PIN verification + anonymous sign-in + redeem ────────────────────────────
// Used when the coordinator has enabled PIN requirement (default).
// Atomically increments attempt counter; locks after MAX_PIN_ATTEMPTS wrong guesses.
// On lock, coordinator must generate a new invite — there is no unlock path.

export async function verifyPinAndJoin(
  token: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const pin = String(formData.get('pin') ?? '').trim()

  if (!/^\d{6}$/.test(pin)) {
    return { error: 'Enter the 6-digit code your coordinator shared with you.' }
  }

  const service = createServiceClient()

  // Fetch invite — include PIN columns needed for verification
  const { data: invite } = await service
    .from('patient_invites')
    .select('id, patient_id, pin_hash, pin_attempts, pin_locked_at, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite || !invite.pin_hash) return { error: 'This invite link is invalid.' }
  if (invite.used_at)             return { error: 'This invite link has already been used.' }
  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite link has expired. Ask your coordinator for a new one.' }
  }
  if (invite.pin_locked_at) {
    return { error: `Access code locked after ${MAX_PIN_ATTEMPTS} wrong attempts. Ask your coordinator to share a new link.` }
  }

  const correct = await compare(pin, invite.pin_hash)

  if (!correct) {
    // Atomically increment attempts; lock if threshold reached
    const newAttempts = (invite.pin_attempts ?? 0) + 1
    const shouldLock  = newAttempts >= MAX_PIN_ATTEMPTS

    await service
      .from('patient_invites')
      .update({
        pin_attempts:  newAttempts,
        pin_locked_at: shouldLock ? new Date().toISOString() : null,
      })
      .eq('id', invite.id)
      .is('pin_locked_at', null) // guard against concurrent requests

    log.warn('join-pin', 'wrong PIN', { attempts: newAttempts, locked: shouldLock })

    if (shouldLock) {
      return { error: `Too many wrong attempts. This link is now locked. Ask your coordinator to share a new one.` }
    }

    const remaining = MAX_PIN_ATTEMPTS - newAttempts
    return { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }
  }

  // PIN correct — create anonymous session and redeem
  const supabase = await createClient()
  const { data: { user }, error: signInError } = await supabase.auth.signInAnonymously({
    options: { data: { role: 'patient' } },
  })

  if (signInError || !user) {
    log.error('join-pin', 'anonymous sign-in failed', { message: signInError?.message })
    return { error: 'Could not set up access. Please try again.' }
  }

  const result = await redeemToken(token, user.id)
  if (!result.ok) return { error: result.error! }

  redirect(`/dashboard/${result.patientId}`)
}

// ── Sign in with existing account + redeem ────────────────────────────────────

export async function signInAndJoin(
  token: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = { email: formData.get('email'), password: formData.get('password') }
  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data)

  if (signInError) {
    log.warn('join-signin', 'sign-in failed', { code: (signInError as { code?: string }).code })
    return { error: 'Incorrect email or password. Please try again.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign-in succeeded but no session was found. Please try again.' }

  const result = await redeemToken(token, user.id)
  if (!result.ok) return { error: result.error! }
  redirect(`/dashboard/${result.patientId}`)
}

// ── Sign up with new account + redeem ────────────────────────────────────────

export async function signUpAndJoin(
  token: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: 'patient',
  }
  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name, role: 'patient' } },
  })

  if (signUpError) {
    const code = (signUpError as { code?: string }).code
    log.error('join-signup', 'signUp error', { code, message: signUpError.message })
    if (code === 'user_already_exists' || code === 'email_exists') {
      return { error: 'An account with this email already exists. Sign in instead.' }
    }
    return { error: 'Could not create your account. Please try again.' }
  }

  // Email confirmation is disabled, so signUp() creates an immediate session.
  // A null user here would be an unexpected session fault, not a confirmation requirement.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Account created but session was not found. Please try signing in.' }
  }

  const result = await redeemToken(token, user.id)
  if (!result.ok) return { error: result.error! }
  redirect(`/dashboard/${result.patientId}`)
}
