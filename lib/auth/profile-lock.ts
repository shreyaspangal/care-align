import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

// PIN unlock = short-lived HMAC-signed cookie per profile. This is a privacy
// lock WITHIN the family, not a security boundary — the account password is
// the real boundary, and RLS cannot distinguish family members because there
// is only one auth user (SYSTEM_DESIGN §D, honest threat model).

const UNLOCK_TTL_SECONDS = 15 * 60

function secret(): string {
  // Server-only secret that already exists in every environment; a dedicated
  // signing key would add env friction for no additional protection here.
  return process.env.SUPABASE_SERVICE_ROLE_KEY!
}

function sign(profileId: string, expiresAt: number): string {
  return createHmac('sha256', secret()).update(`${profileId}.${expiresAt}`).digest('hex')
}

function cookieName(profileId: string): string {
  return `profile_unlock_${profileId}`
}

export async function grantProfileUnlock(profileId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS
  const store = await cookies()
  store.set(cookieName(profileId), `${expiresAt}.${sign(profileId, expiresAt)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: UNLOCK_TTL_SECONDS,
    path: '/',
  })
}

export async function isProfileUnlocked(profileId: string): Promise<boolean> {
  const store = await cookies()
  const value = store.get(cookieName(profileId))?.value
  if (!value) return false

  const [expiresAtRaw, signature] = value.split('.')
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) return false

  const expected = sign(profileId, expiresAt)
  if (signature?.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
