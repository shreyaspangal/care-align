// Single source of truth for all input validation (CLAUDE.md stop condition:
// no action or form ships without a schema here). Zod v4 API.

import * as z from 'zod'
import { PROFILE_COLORS, SEXES } from '@/lib/types/domain'

// ── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  familyName: z
    .string()
    .trim()
    .min(1, 'Give your family space a name')
    .max(80, 'Keep the name under 80 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
})
export type RegisterInput = z.infer<typeof RegisterSchema>

export const LoginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof LoginSchema>

// ── Profiles ─────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  name: z.string().trim().min(1, 'Every profile needs a name').max(80),
  // ISO date string from <input type="date">; optional — dob is never required
  dob: z.iso.date('Enter a valid date').optional().or(z.literal('').transform(() => undefined)),
  sex: z.enum(SEXES).optional().or(z.literal('').transform(() => undefined)),
  color: z.enum(PROFILE_COLORS).default('accent'),
})
export type ProfileInput = z.infer<typeof ProfileSchema>

// PIN is a 4-digit privacy lock within the family — not a security credential
// (see SYSTEM_DESIGN §D). Account password is the real boundary.
const Pin4 = z.string().regex(/^\d{4}$/, 'PIN is exactly 4 digits')

// Unlock + first-time set (no existing PIN → nothing to verify against).
export const PinSchema = z.object({ pin: Pin4 })
export type PinInput = z.infer<typeof PinSchema>

// Changing or removing an EXISTING PIN requires proof of scope:
//   profile-holder → knows the current PIN
//   account-holder → re-enters the account password (the recovery path;
//                    identity can't prove this — the family shares one login)
const VerifyByPin = z.object({ verifyWith: z.literal('pin'), currentPin: Pin4 })
const VerifyByPassword = z.object({
  verifyWith: z.literal('password'),
  accountPassword: z.string().min(1, 'Enter the account password'),
})

export const ChangePinSchema = z.discriminatedUnion('verifyWith', [
  VerifyByPin.extend({ newPin: Pin4 }),
  VerifyByPassword.extend({ newPin: Pin4 }),
])
export type ChangePinInput = z.infer<typeof ChangePinSchema>

export const RemovePinSchema = z.discriminatedUnion('verifyWith', [VerifyByPin, VerifyByPassword])
export type RemovePinInput = z.infer<typeof RemovePinSchema>
