/**
 * Seeds the dev/test Supabase project with one coordinator, one patient user,
 * one patient record, one episode, and the access grants linking them.
 *
 * Run once:
 *   npx tsx scripts/seed-dev.ts
 *
 * Credentials after seeding:
 *   Coordinator — coordinator@carealig.dev / Test1234!
 *   Patient     — patient@carealig.dev     / Test1234!
 *
 * Safe to re-run — upserts where possible, skips if auth users already exist.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  console.error('Run: source .env.local before this script, or prefix with dotenv.')
  process.exit(1)
}

// Service role client bypasses RLS — only for seeding
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const COORDINATOR_EMAIL = 'coordinator@carealig.dev'
const PATIENT_EMAIL = 'patient@carealig.dev'
const PASSWORD = 'Test1234!'

async function createAuthUser(email: string, name: string, role: 'coordinator' | 'patient') {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing.users.find((u) => u.email === email)
  if (found) {
    console.log(`  ✓ Auth user already exists: ${email} (${found.id})`)
    return found.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  console.log(`  ✓ Created auth user: ${email} (${data.user.id})`)
  return data.user.id
}

async function main() {
  console.log('\n── Seeding CareAlign dev database ──\n')

  // 1. Create auth users (trigger auto-creates profiles rows)
  console.log('1. Creating auth users…')
  const coordId = await createAuthUser(COORDINATOR_EMAIL, 'Shreyas (Coordinator)', 'coordinator')
  const patientUserId = await createAuthUser(PATIENT_EMAIL, 'Ramesh Sharma (Patient)', 'patient')

  // 2. Create patient record
  console.log('\n2. Creating patient record…')
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('name', 'Ramesh Sharma')
    .maybeSingle()

  let patientId: string
  if (existingPatient) {
    patientId = existingPatient.id
    console.log(`  ✓ Patient record already exists (${patientId})`)
  } else {
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        name: 'Ramesh Sharma',
        date_of_birth: '1958-04-12',
        gender: 'Male',
        blood_group: 'B+',
        insurance_provider_name: 'Star Health Insurance',
        admission_status: 'admitted',
      })
      .select('id')
      .single()

    if (error || !patient) throw new Error(`Failed to create patient: ${error?.message}`)
    patientId = patient.id
    console.log(`  ✓ Created patient: Ramesh Sharma (${patientId})`)
  }

  // 3. Create patient_access rows
  console.log('\n3. Creating access grants…')
  await supabase.from('patient_access').upsert(
    [
      { user_id: coordId, patient_id: patientId, role: 'coordinator' },
      { user_id: patientUserId, patient_id: patientId, role: 'patient' },
    ],
    { onConflict: 'user_id,patient_id' }
  )
  console.log('  ✓ Coordinator access granted')
  console.log('  ✓ Patient access granted')

  // 4. Create active episode
  console.log('\n4. Creating active episode…')
  const { data: existingEpisode } = await supabase
    .from('episodes')
    .select('id')
    .eq('patient_id', patientId)
    .maybeSingle()

  let episodeId: string
  if (existingEpisode) {
    episodeId = existingEpisode.id
    console.log(`  ✓ Episode already exists (${episodeId})`)
  } else {
    const { data: episode, error } = await supabase
      .from('episodes')
      .insert({
        patient_id: patientId,
        started_at: new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select('id')
      .single()

    if (error || !episode) throw new Error(`Failed to create episode: ${error?.message}`)
    episodeId = episode.id
    console.log(`  ✓ Created active episode (${episodeId})`)
  }

  // 5. Print credentials
  console.log('\n── Done ──────────────────────────────────\n')
  console.log('Test credentials:\n')
  console.log(`  Coordinator`)
  console.log(`    Email:    ${COORDINATOR_EMAIL}`)
  console.log(`    Password: ${PASSWORD}`)
  console.log(`    Dashboard: /dashboard/${patientId}\n`)
  console.log(`  Patient`)
  console.log(`    Email:    ${PATIENT_EMAIL}`)
  console.log(`    Password: ${PASSWORD}`)
  console.log(`    View:     /patient/${patientId}\n`)
  console.log(`  Patient ID:  ${patientId}`)
  console.log(`  Episode ID:  ${episodeId}`)
  console.log('\n──────────────────────────────────────────\n')
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
