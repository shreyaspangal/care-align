'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyAccountPassword } from '@/lib/auth/account-password'
import { grantProfileUnlock } from '@/lib/auth/profile-lock'
import {
  ChangePinSchema,
  PinSchema,
  ProfileSchema,
  RemovePinSchema,
  type RemovePinInput,
} from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('actions:profiles')

export type ProfileFormState = {
  error?: string
} | undefined

function parseProfileForm(formData: FormData) {
  return ProfileSchema.safeParse({
    name: formData.get('name'),
    dob: formData.get('dob') ?? '',
    sex: formData.get('sex') ?? '',
    color: formData.get('color') ?? 'accent',
  })
}

export async function addProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = parseProfileForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id').maybeSingle()
  if (!family) {
    return { error: 'No family found for this account' }
  }

  const { error } = await supabase.from('profiles').insert({
    family_id: family.id,
    name: parsed.data.name,
    dob: parsed.data.dob ?? null,
    sex: parsed.data.sex ?? null,
    color: parsed.data.color,
  })
  if (error) {
    log.error('addProfile', 'insert failed', { error: error.message })
    return { error: 'Could not create the profile' }
  }

  revalidatePath('/profiles')
  redirect('/profiles')
}

export async function updateProfile(
  profileId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = parseProfileForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name: parsed.data.name,
      dob: parsed.data.dob ?? null,
      sex: parsed.data.sex ?? null,
      color: parsed.data.color,
    })
    .eq('id', profileId)
    .select('id') // 0 rows back = RLS filtered the write (ANTI_PATTERNS §1)
  if (error || !data?.length) {
    log.error('updateProfile', 'update failed or wrote 0 rows', {
      profileId,
      error: error?.message,
    })
    return { error: 'Could not save the profile' }
  }

  revalidatePath('/profiles')
  redirect('/profiles')
}

// Changing or removing an existing PIN requires proof of scope
// (SYSTEM_DESIGN §D): the profile-holder proves it with the current PIN; the
// account-holder proves it by re-entering the account password — identity
// can't distinguish them, the family shares one login.
async function verifyPinAuthority(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  verification: RemovePinInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('pin_hash')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) {
    return { ok: false, error: 'Profile not found' }
  }
  if (!profile.pin_hash) {
    return { ok: false, error: 'This profile has no PIN' }
  }

  if (verification.verifyWith === 'pin') {
    if (!(await bcrypt.compare(verification.currentPin, profile.pin_hash))) {
      return { ok: false, error: 'Wrong PIN' }
    }
    return { ok: true }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return { ok: false, error: 'Could not verify the account' }
  }
  if (!(await verifyAccountPassword(user.email, verification.accountPassword))) {
    return { ok: false, error: 'Wrong account password' }
  }
  return { ok: true }
}

function parsePinVerification(formData: FormData) {
  return {
    verifyWith: formData.get('verifyWith'),
    currentPin: formData.get('currentPin') ?? undefined,
    accountPassword: formData.get('accountPassword') ?? undefined,
  }
}

export async function setProfilePin(
  profileId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = PinSchema.safeParse({ pin: formData.get('pin') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  // First-time set ONLY — replacing an existing PIN goes through
  // changeProfilePin, which demands proof of scope.
  const { data: profile } = await supabase
    .from('profiles')
    .select('pin_hash')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) {
    return { error: 'Profile not found' }
  }
  if (profile.pin_hash) {
    return { error: 'This profile already has a PIN — changing it requires the current PIN or the account password' }
  }

  const pinHash = await bcrypt.hash(parsed.data.pin, 10)
  const { data, error } = await supabase
    .from('profiles')
    .update({ pin_hash: pinHash })
    .eq('id', profileId)
    .select('id')
  if (error || !data?.length) {
    log.error('setProfilePin', 'update failed or wrote 0 rows', {
      profileId,
      error: error?.message,
    })
    return { error: 'Could not set the PIN' }
  }

  await grantProfileUnlock(profileId)
  revalidatePath('/profiles')
  redirect('/profiles')
}

export async function changeProfilePin(
  profileId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = ChangePinSchema.safeParse({
    ...parsePinVerification(formData),
    newPin: formData.get('newPin'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const authority = await verifyPinAuthority(supabase, profileId, parsed.data)
  if (!authority.ok) {
    return { error: authority.error }
  }

  const pinHash = await bcrypt.hash(parsed.data.newPin, 10)
  const { data, error } = await supabase
    .from('profiles')
    .update({ pin_hash: pinHash })
    .eq('id', profileId)
    .select('id')
  if (error || !data?.length) {
    log.error('changeProfilePin', 'update failed or wrote 0 rows', {
      profileId,
      error: error?.message,
    })
    return { error: 'Could not change the PIN' }
  }

  await grantProfileUnlock(profileId)
  revalidatePath('/profiles')
  redirect('/profiles')
}

export async function removeProfilePin(
  profileId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = RemovePinSchema.safeParse(parsePinVerification(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const authority = await verifyPinAuthority(supabase, profileId, parsed.data)
  if (!authority.ok) {
    return { error: authority.error }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ pin_hash: null })
    .eq('id', profileId)
    .select('id')
  if (error || !data?.length) {
    log.error('removeProfilePin', 'update failed or wrote 0 rows', {
      profileId,
      error: error?.message,
    })
    return { error: 'Could not remove the PIN' }
  }

  revalidatePath('/profiles')
  redirect('/profiles')
}

export async function unlockProfile(
  profileId: string,
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = PinSchema.safeParse({ pin: formData.get('pin') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('pin_hash')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) {
    return { error: 'Profile not found' }
  }
  if (profile.pin_hash && !(await bcrypt.compare(parsed.data.pin, profile.pin_hash))) {
    return { error: 'Wrong PIN' }
  }

  await grantProfileUnlock(profileId)
  redirect(`/p/${profileId}`)
}
