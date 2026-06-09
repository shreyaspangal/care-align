// Fixed UUIDs for test seed data. Deterministic across runs so tests can
// reference known IDs without querying for them. Populated by scripts/seed-test-db.ts.
export const SEED = {
  coordA: {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'coord-a@test.com',
    password: 'test-password-1234',
  },
  coordB: {
    userId: '00000000-0000-0000-0000-000000000002',
    email: 'coord-b@test.com',
    password: 'test-password-1234',
  },
  patient: {
    userId: '00000000-0000-0000-0000-000000000003',
    email: 'patient@test.com',
    password: 'test-password-1234',
  },
  patientAId: '00000000-0000-0000-0001-000000000001', // patient record for coord-a
  patientBId: '00000000-0000-0000-0001-000000000002', // patient record for coord-b
  episodeAId: '00000000-0000-0000-0002-000000000001', // episode for patient-a
} as const
