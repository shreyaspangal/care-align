import { describe, expect, it } from 'vitest'
import {
  ChangePinSchema,
  LoginSchema,
  OrganizeSchema,
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

describe('OrganizeSchema', () => {
  // A fully-populated, readable prescription.
  const full = {
    readable: true,
    doc_type: 'prescription',
    title: 'Prescription — Dr. Rao',
    title_is_guessed: false,
    document_date: '2024-03-12',
    doctor_name: 'Dr. Rao',
    facility_name: 'Apollo Clinic',
    patient_name_as_written: 'Ramesh Kumar',
    what_it_says: 'A prescription listing two medications.',
    terms: [{ term: 'BD', plain_explanation: 'twice a day' }],
    medications_as_written: [
      { name: 'Metformin', strength: '500mg', frequency: 'twice daily', form: 'tablet' },
    ],
    tests_as_written: [],
  }

  it('accepts a complete, readable document', () => {
    expect(OrganizeSchema.safeParse(full).success).toBe(true)
  })

  it('honors verbatim-or-null: every extracted field accepts null', () => {
    const sparse = {
      ...full,
      document_date: null,
      doctor_name: null,
      facility_name: null,
      patient_name_as_written: null,
      medications_as_written: [
        { name: 'Amlodipine', strength: null, frequency: null, form: null },
      ],
      tests_as_written: [
        { name: 'HbA1c', value: null, unit: null, reference_range: null, flag_as_written: null },
      ],
    }
    expect(OrganizeSchema.safeParse(sparse).success).toBe(true)
  })

  it('captures a printed abnormality flag verbatim (D-012)', () => {
    const withFlag = {
      ...full,
      tests_as_written: [
        { name: 'Fasting glucose', value: '126', unit: 'mg/dL', reference_range: '70-100', flag_as_written: 'HIGH' },
      ],
    }
    expect(OrganizeSchema.safeParse(withFlag).success).toBe(true)
  })

  it('accepts an unreadable scan with empty facts (needs_review path)', () => {
    const unreadable = {
      readable: false,
      doc_type: 'other',
      title: 'Unreadable document',
      title_is_guessed: true,
      document_date: null,
      doctor_name: null,
      facility_name: null,
      patient_name_as_written: null,
      what_it_says: 'This document could not be read clearly.',
      terms: [],
      medications_as_written: [],
      tests_as_written: [],
    }
    expect(OrganizeSchema.safeParse(unreadable).success).toBe(true)
  })

  it('rejects an unknown doc_type and a malformed document_date', () => {
    expect(OrganizeSchema.safeParse({ ...full, doc_type: 'x_ray' }).success).toBe(false)
    expect(OrganizeSchema.safeParse({ ...full, document_date: '12/03/2024' }).success).toBe(false)
  })

  it('rejects a fact with a missing required name (never a nameless record)', () => {
    const nameless = {
      ...full,
      medications_as_written: [{ strength: '5mg', frequency: null, form: null }],
    }
    expect(OrganizeSchema.safeParse(nameless).success).toBe(false)
  })
})
