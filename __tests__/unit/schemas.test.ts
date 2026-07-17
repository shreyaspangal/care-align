import { describe, expect, it } from 'vitest'
import {
  ChangePinSchema,
  LoginSchema,
  PinSchema,
  ProfileSchema,
  RegisterSchema,
  RemovePinSchema,
} from '@/lib/validation/schemas'

describe('RegisterSchema', () => {
  it('accepts a valid registration', () => {
    const result = RegisterSchema.safeParse({
      familyName: 'The Sharmas',
      email: 'a@b.com',
      password: 'longenough',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a short password and a bad email', () => {
    expect(
      RegisterSchema.safeParse({ familyName: 'X', email: 'a@b.com', password: 'short' }).success
    ).toBe(false)
    expect(
      RegisterSchema.safeParse({ familyName: 'X', email: 'not-an-email', password: 'longenough' })
        .success
    ).toBe(false)
  })

  it('trims and rejects whitespace-only family names', () => {
    expect(
      RegisterSchema.safeParse({ familyName: '   ', email: 'a@b.com', password: 'longenough' })
        .success
    ).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('requires a non-empty password', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})

describe('ProfileSchema', () => {
  it('accepts name-only input and defaults the color', () => {
    const result = ProfileSchema.safeParse({ name: 'Amma', dob: '', sex: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dob).toBeUndefined()
      expect(result.data.sex).toBeUndefined()
      expect(result.data.color).toBe('accent')
    }
  })

  it('accepts an ISO dob and rejects garbage dates', () => {
    expect(ProfileSchema.safeParse({ name: 'A', dob: '1962-04-15' }).success).toBe(true)
    expect(ProfileSchema.safeParse({ name: 'A', dob: '15/04/1962' }).success).toBe(false)
  })

  it('rejects unknown colors and sexes', () => {
    expect(ProfileSchema.safeParse({ name: 'A', color: 'red' }).success).toBe(false)
    expect(ProfileSchema.safeParse({ name: 'A', sex: 'unknown' }).success).toBe(false)
  })
})

describe('PinSchema', () => {
  it('accepts exactly 4 digits', () => {
    expect(PinSchema.safeParse({ pin: '0042' }).success).toBe(true)
  })

  it.each(['123', '12345', '12a4', ''])('rejects %j', (pin) => {
    expect(PinSchema.safeParse({ pin }).success).toBe(false)
  })
})

describe('ChangePinSchema', () => {
  it('accepts verification by current PIN', () => {
    expect(
      ChangePinSchema.safeParse({ verifyWith: 'pin', currentPin: '1234', newPin: '5678' }).success
    ).toBe(true)
  })

  it('accepts verification by account password', () => {
    expect(
      ChangePinSchema.safeParse({
        verifyWith: 'password',
        accountPassword: 'hunter2-family',
        newPin: '5678',
      }).success
    ).toBe(true)
  })

  it('rejects a change with no verification proof', () => {
    expect(ChangePinSchema.safeParse({ verifyWith: 'pin', newPin: '5678' }).success).toBe(false)
    expect(ChangePinSchema.safeParse({ verifyWith: 'password', newPin: '5678' }).success).toBe(
      false
    )
    expect(ChangePinSchema.safeParse({ newPin: '5678' }).success).toBe(false)
  })

  it('rejects an empty account password and a malformed new PIN', () => {
    expect(
      ChangePinSchema.safeParse({ verifyWith: 'password', accountPassword: '', newPin: '5678' })
        .success
    ).toBe(false)
    expect(
      ChangePinSchema.safeParse({ verifyWith: 'pin', currentPin: '1234', newPin: '56789' }).success
    ).toBe(false)
  })
})

describe('RemovePinSchema', () => {
  it('accepts either verification path, rejects missing proof', () => {
    expect(RemovePinSchema.safeParse({ verifyWith: 'pin', currentPin: '1234' }).success).toBe(true)
    expect(
      RemovePinSchema.safeParse({ verifyWith: 'password', accountPassword: 'hunter2-family' })
        .success
    ).toBe(true)
    expect(RemovePinSchema.safeParse({ verifyWith: 'pin' }).success).toBe(false)
  })
})
