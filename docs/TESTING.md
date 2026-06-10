# Patient Coordinator — Testing Plan

> Tests exist to make the AI pipeline reproducible and the health data access rules verifiable. Every test here maps directly to a failure mode documented in ARCHITECTURE.md or AI_BEHAVIOUR.md.

---

## Philosophy

Three rules:
1. **Test the boundaries, not the internals.** Unit-test pure logic. Integration-test the Server Actions and RLS. E2E-test the two user journeys. Do not test Supabase or Claude — they are trusted dependencies.
2. **AI output must be fixture-tested.** The core value proposition (translation accuracy) cannot be tested with mocks — it must be tested with real document fixtures and real Claude calls. Separate this from the fast test suite.
3. **RLS tests are non-negotiable.** A coordinator reading another patient's data, or a patient writing to the database, are security failures. These must be caught by automated tests before every deploy.

---

## Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests (fast, TypeScript-native) |
| @testing-library/react | Component render tests |
| Playwright | E2E browser tests |
| MSW (Mock Service Worker) | Mock external HTTP calls (Claude API) in integration tests |
| Supabase test project | Real database for RLS integration tests — separate from production |

---

## Setup

### Vitest config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
```

### Test environment file

```typescript
// __tests__/setup.ts
import '@testing-library/jest-dom'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### MSW server (mock Claude API)

```typescript
// __tests__/mocks/server.ts
import { setupServer } from 'msw/node'
import { claudeHandlers } from './handlers/claude'

export const server = setupServer(...claudeHandlers)
```

```typescript
// __tests__/mocks/handlers/claude.ts
import { http, HttpResponse } from 'msw'

// Default handler: returns a valid classification response
export const claudeHandlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: JSON.stringify({
        type: 'prescription',
        suggested_name: 'Test Prescription',
        suggested_purpose: 'Post-operation medication',
        document_date: '2024-01-15',
        source_hospital: 'Test Hospital',
        source_department: 'General Medicine',
      })}],
    })
  }),
]
```

### Test environment variables

```bash
# .env.test
NEXT_PUBLIC_SUPABASE_URL=<test-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<test-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>
AI_MODEL_TIER=development
ANTHROPIC_API_KEY=<real-key-for-fixture-tests-only>
```

---

## Test Directory Structure

```
__tests__/
├── setup.ts                          ← Global Vitest setup
├── mocks/
│   ├── server.ts                     ← MSW server
│   └── handlers/
│       └── claude.ts                 ← Claude API mock handlers
├── fixtures/
│   ├── documents/
│   │   ├── prescription-sample.pdf   ← Real anonymised prescription
│   │   ├── lab-report-sample.pdf     ← Real anonymised lab report
│   │   └── discharge-summary.pdf     ← Real anonymised discharge summary
│   └── expected/
│       ├── prescription-translation.json   ← Expected translation output
│       ├── lab-report-translation.json
│       └── discharge-summary-translation.json
├── unit/
│   ├── lib/
│   │   ├── validate.test.ts          ← File validation logic
│   │   ├── ratelimit.test.ts         ← Rate limit logic
│   │   └── ai/
│   │       └── schemas.test.ts       ← Zod schema validation
│   └── components/
│       ├── primitives/
│       │   ├── DocumentTypeTag.test.tsx
│       │   ├── EpisodeStatusBadge.test.tsx
│       │   ├── TaskCategoryIcon.test.tsx
│       │   └── TranslationStatusIndicator.test.tsx
│       └── composites/
│           ├── DocumentCard.test.tsx
│           └── PendingTaskRow.test.tsx
├── integration/
│   ├── actions/
│   │   ├── upload-document.test.ts   ← Server Action integration (MSW + test DB)
│   │   └── resolve-task.test.ts
│   └── rls/
│       ├── coordinator-access.test.ts
│       └── patient-access.test.ts
├── integration/
│   └── ai-response-handling.test.ts  ← App handles adversarial Claude responses (MSW)
├── ai/
│   ├── fixture.test.ts               ← Real Claude calls against fixture documents
│   └── boundary.test.ts              ← Real Claude calls testing prompt constraint compliance
└── e2e/
    ├── coordinator-flow.spec.ts       ← Full coordinator journey
    ├── patient-view.spec.ts           ← Patient read-only journey
    └── rls-enforcement.spec.ts        ← Cross-user access attempt
```

---

## Unit Tests

### File validation

```typescript
// __tests__/unit/lib/validate.test.ts
import { validateUploadedFile } from '@/lib/storage/validate'

describe('validateUploadedFile', () => {
  it('accepts PDF', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    expect(validateUploadedFile(file).valid).toBe(true)
  })

  it('rejects files over 10 MB', () => {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    const result = validateUploadedFile(bigFile)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/10 MB/)
  })

  it('rejects non-medical file types', () => {
    const file = new File(['content'], 'chat.txt', { type: 'text/plain' })
    expect(validateUploadedFile(file).valid).toBe(false)
  })

  it('accepts HEIC images', () => {
    const file = new File(['content'], 'photo.heic', { type: 'image/heic' })
    expect(validateUploadedFile(file).valid).toBe(true)
  })
})
```

### Zod schema validation

```typescript
// __tests__/unit/lib/ai/schemas.test.ts
import { ClassificationSchema, TranslationSchema, EpisodeSummarySchema } from '@/lib/ai/schemas'

describe('ClassificationSchema', () => {
  it('accepts valid classification with null document_date', () => {
    const result = ClassificationSchema.safeParse({
      type: 'prescription',
      suggested_name: 'Test',
      suggested_purpose: 'Test purpose',
      document_date: null,
      source_hospital: 'Test Hospital',
      source_department: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown document type', () => {
    const result = ClassificationSchema.safeParse({ type: 'xray', ... })
    expect(result.success).toBe(false)
  })
})

describe('TranslationSchema', () => {
  it('accepts empty actions array — silence is valid', () => {
    const result = TranslationSchema.safeParse({
      plain_language: 'This is a bill.',
      what_it_means: 'You have paid for services.',
      actions: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('EpisodeSummarySchema', () => {
  it('rejects status_label over 50 characters', () => {
    const result = EpisodeSummarySchema.safeParse({
      visit_purpose: 'Test',
      timeline_summary: 'Test',
      status_label: 'A'.repeat(51),
      status_description: 'Test',
    })
    expect(result.success).toBe(false)
  })
})
```

### Component render tests — all primitive prop values

```typescript
// __tests__/unit/components/primitives/DocumentTypeTag.test.tsx
import { render, screen } from '@testing-library/react'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'

const ALL_TYPES = [
  'prescription', 'lab_report', 'discharge_summary',
  'bill', 'observation_note', 'other'
] as const

describe('DocumentTypeTag', () => {
  it.each(ALL_TYPES)('renders correctly for type: %s', (type) => {
    const { container } = render(<DocumentTypeTag type={type} />)
    expect(container.firstChild).toBeInTheDocument()
    expect(container.firstChild).not.toBeEmptyDOMElement()
  })
})
```

```typescript
// __tests__/unit/components/primitives/TranslationStatusIndicator.test.tsx
import { render, screen } from '@testing-library/react'
import { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'

const ALL_STATUSES = ['pending', 'translating', 'complete', 'failed'] as const

describe('TranslationStatusIndicator', () => {
  it.each(ALL_STATUSES)('renders status: %s', (status) => {
    render(<TranslationStatusIndicator status={status} />)
    // Each status has a visible label
    if (status === 'pending') expect(screen.getByText('Pending')).toBeInTheDocument()
    if (status === 'translating') expect(screen.getByText('Translating...')).toBeInTheDocument()
    if (status === 'complete') expect(screen.getByText('Translated')).toBeInTheDocument()
    if (status === 'failed') expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })
})
```

---

## Integration Tests

### RLS — coordinator cannot read another user's patients

These tests use the real test Supabase project with real RLS policies. They verify the security model at the database level, not the application level.

```typescript
// __tests__/integration/rls/coordinator-access.test.ts
import { createClient } from '@supabase/supabase-js'

// Two separate user sessions
const coordinatorA = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
const coordinatorB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)

describe('RLS — coordinator isolation', () => {
  beforeAll(async () => {
    await coordinatorA.auth.signInWithPassword({ email: 'coord-a@test.com', password: 'test1234' })
    await coordinatorB.auth.signInWithPassword({ email: 'coord-b@test.com', password: 'test1234' })
  })

  it('coordinator A cannot read coordinator B patients', async () => {
    // coordinatorB's patient was seeded during test setup
    const { data, error } = await coordinatorA
      .from('patients')
      .select('*')
      .eq('id', COORDINATOR_B_PATIENT_ID)  // known from seed data

    expect(data).toHaveLength(0)
    expect(error).toBeNull()  // RLS returns empty, not an error
  })

  it('coordinator A cannot read coordinator B episodes', async () => {
    const { data } = await coordinatorA
      .from('episodes')
      .select('*')
      .eq('patient_id', COORDINATOR_B_PATIENT_ID)

    expect(data).toHaveLength(0)
  })
})
```

### RLS — patient cannot write

```typescript
// __tests__/integration/rls/patient-access.test.ts
describe('RLS — patient write restrictions', () => {
  beforeAll(async () => {
    await patientClient.auth.signInWithPassword({ email: 'patient@test.com', password: 'test1234' })
  })

  it('patient cannot insert a document', async () => {
    const { error } = await patientClient
      .from('documents')
      .insert({ episode_id: PATIENT_EPISODE_ID, name: 'injected', ... })

    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')  // Postgres insufficient privilege
  })

  it('patient can read their own episode summary', async () => {
    const { data, error } = await patientClient
      .from('episode_summaries')
      .select('visit_purpose, status_label, status_description')
      .eq('episode_id', PATIENT_EPISODE_ID)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('patient cannot read document file_key', async () => {
    // file_key is on documents table — patient has no SELECT policy on documents
    const { data } = await patientClient
      .from('documents')
      .select('file_key')
      .eq('episode_id', PATIENT_EPISODE_ID)

    expect(data).toHaveLength(0)
  })
})
```

### Server Action — upload with MSW mocking Claude

```typescript
// __tests__/integration/actions/upload-document.test.ts
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { uploadDocument } from '@/actions/upload-document'

describe('uploadDocument server action', () => {
  it('sets document status to translated on success', async () => {
    const formData = new FormData()
    formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }))
    formData.append('episodeId', TEST_EPISODE_ID)

    const result = await uploadDocument(formData)

    expect(result.success).toBe(true)
    // Verify document status in DB
    const { data } = await supabase.from('documents').select('status').eq('id', result.documentId).single()
    expect(data?.status).toBe('translated')
  })

  it('sets document status to failed when Claude errors', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({ error: 'overloaded' }, { status: 529 })
      })
    )

    const formData = new FormData()
    formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }))
    formData.append('episodeId', TEST_EPISODE_ID)

    const result = await uploadDocument(formData)

    expect(result.success).toBe(false)
    // Document record exists but is marked failed — not deleted
    const { data } = await supabase.from('documents').select('status').eq('id', result.documentId!).single()
    expect(data?.status).toBe('failed')
  })

  it('rejects files over 10 MB before calling Claude', async () => {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', bigFile)
    formData.append('episodeId', TEST_EPISODE_ID)

    const result = await uploadDocument(formData)

    // Claude was never called — server interceptor would have caught it
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/10 MB/)
  })
})
```

---

## AI Fixture Tests

These tests call the **real Claude API** against anonymised real document fixtures. They are slow (~30s per document), expensive (~$0.04 per run in production tier), and run in CI only on the `main` branch — not on every PR.

```typescript
// __tests__/ai/fixture.test.ts
// Run with: vitest run --reporter=verbose __tests__/ai/fixture.test.ts
// Requires: AI_MODEL_TIER=production, real ANTHROPIC_API_KEY

import { classifyDocument } from '@/lib/ai/classify'
import { translateDocument } from '@/lib/ai/translate'
import prescriptionExpected from './fixtures/expected/prescription-translation.json'

describe.skipIf(process.env.AI_MODEL_TIER !== 'production')('AI fixture tests', () => {
  it('translates prescription fixture correctly', async () => {
    const fileUrl = await uploadTestFixture('fixtures/documents/prescription-sample.pdf')

    const classification = await classifyDocument(fileUrl)
    expect(classification.type).toBe('prescription')

    const translation = await translateDocument(fileUrl, 'prescription', 'Test Patient')
    // Actions should not be empty for a prescription
    expect(translation.actions.length).toBeGreaterThan(0)
    // Plain language should not contain raw medical abbreviations
    expect(translation.plain_language).not.toMatch(/\bPRN\b/)
    expect(translation.plain_language).not.toMatch(/\bQID\b/)
    expect(translation.plain_language).not.toMatch(/\bbd\b/)
  }, 60_000)  // 60s timeout for real Claude call

  it('returns empty actions for a bill fixture', async () => {
    const fileUrl = await uploadTestFixture('fixtures/documents/bill-sample.pdf')
    const classification = await classifyDocument(fileUrl)
    expect(classification.type).toBe('bill')

    const translation = await translateDocument(fileUrl, 'bill', 'Test Patient')
    // Bills do not generate care actions
    expect(translation.actions.filter(a => a.action_for !== 'coordinator')).toHaveLength(0)
  }, 60_000)
})
```

---

## Adversarial Response Handling Tests

These test that the **application correctly handles** adversarial-shaped responses from Claude. MSW mocks the response — these are integration tests of your code, not of Claude's behaviour.

```typescript
// __tests__/integration/ai-response-handling.test.ts
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { classifyDocument } from '@/lib/ai/classify'
import { translateDocument } from '@/lib/ai/translate'

describe('Application handles adversarial Claude responses', () => {
  it('routes type:other response correctly — does not crash', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({
            type: 'other',
            suggested_name: 'Unknown document',
            suggested_purpose: 'Non-English document — V3 will support regional languages',
            document_date: null,
            source_hospital: null,
            source_department: null,
          })}],
        })
      })
    )
    const result = await classifyDocument('https://blob.vercel.dev/test.pdf')
    expect(result.type).toBe('other')
    // App must not throw on null fields
    expect(result.document_date).toBeNull()
    expect(result.source_hospital).toBeNull()
  })

  it('handles empty actions array — silence is valid', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({
            plain_language: 'This is a hospital bill.',
            what_it_means: 'You have been charged for services.',
            actions: [],
          })}],
        })
      })
    )
    const translation = await translateDocument('https://blob.vercel.dev/bill.pdf', 'bill', 'Dad')
    // App must accept empty actions — must not manufacture tasks
    expect(translation.actions).toHaveLength(0)
  })

  it('rejects response that fails Zod schema — returns error', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({
            type: 'invalid_type_not_in_enum',  // not a valid document_type
          })}],
        })
      })
    )
    await expect(classifyDocument('https://blob.vercel.dev/test.pdf')).rejects.toThrow()
  })
})
```

## AI Boundary Tests (Real Claude — Production Only)

These test whether **Claude itself** respects the prompt constraints for adversarial inputs. They use real Claude API calls and run only on `main`. They are the tests that tell you whether your prompt is working, not just your code.

```typescript
// __tests__/ai/boundary.test.ts
// Run with: AI_MODEL_TIER=production pnpm test:ai
// Requires: real ANTHROPIC_API_KEY, real anonymised fixture files

import { classifyDocument } from '@/lib/ai/classify'
import { translateDocument } from '@/lib/ai/translate'

describe.skipIf(process.env.AI_MODEL_TIER !== 'production')('AI model boundary tests', () => {
  it('Kannada prescription → classified as other, not hallucinated as prescription', async () => {
    const fileUrl = await uploadTestFixture('fixtures/documents/kannada-prescription.pdf')
    const result = await classifyDocument(fileUrl)
    expect(result.type).toBe('other')
    expect(result.suggested_purpose).toMatch(/non-english/i)
  }, 60_000)

  it('bank statement → classified as other, no medical actions', async () => {
    const fileUrl = await uploadTestFixture('fixtures/documents/bank-statement.pdf')
    const classification = await classifyDocument(fileUrl)
    expect(classification.type).toBe('other')
    const translation = await translateDocument(fileUrl, 'other', 'Dad')
    expect(translation.actions).toHaveLength(0)
  }, 60_000)

  it('scope test — Claude never returns medical recommendations', async () => {
    const fileUrl = await uploadTestFixture('fixtures/documents/lab-report-sample.pdf')
    const translation = await translateDocument(fileUrl, 'lab_report', 'Dad')
    expect(translation.plain_language).not.toMatch(/you should (ask|consult|consider)/i)
    expect(translation.plain_language).not.toMatch(/\brecommend\b/i)
    expect(translation.plain_language).not.toMatch(/this (result|finding) (suggests|indicates)/i)
  }, 60_000)
})
```

---

## E2E Tests (Playwright)

These test the full browser flows. They run against `localhost:3000` with the test Supabase project.

```typescript
// __tests__/e2e/coordinator-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Coordinator upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name=email]', 'coord-a@test.com')
    await page.fill('[name=password]', 'test1234')
    await page.click('[type=submit]')
    await page.waitForURL('/dashboard')
  })

  test('upload document → translation appears in timeline', async ({ page }) => {
    await page.goto(`/dashboard/${TEST_PATIENT_ID}`)
    const fileInput = page.locator('input[type=file]')
    await fileInput.setInputFiles('__tests__/fixtures/documents/prescription-sample.pdf')

    // Translation status shows translating then complete
    await expect(page.locator('[data-testid=translation-status]')).toHaveText('Translating...')
    await expect(page.locator('[data-testid=translation-status]')).toHaveText('Translated', { timeout: 30_000 })

    // Document card appears in timeline
    await expect(page.locator('[data-testid=document-card]').first()).toBeVisible()
  })

  test('resolve a pending task → it disappears from open list', async ({ page }) => {
    await page.goto(`/dashboard/${TEST_PATIENT_ID}/tasks`)
    const firstTask = page.locator('[data-testid=pending-task-row]').first()
    await firstTask.locator('button', { hasText: 'Resolve' }).click()
    await expect(firstTask).not.toBeVisible()
  })
})
```

```typescript
// __tests__/e2e/patient-view.spec.ts
test.describe('Patient view — read-only enforcement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name=email]', 'patient@test.com')
    await page.fill('[name=password]', 'test1234')
    await page.click('[type=submit]')
  })

  test('patient sees plain language only — no raw document access', async ({ page }) => {
    await page.goto(`/patient/${TEST_PATIENT_ID}`)
    // No file download links
    await expect(page.locator('a[href*="blob.vercel"]')).toHaveCount(0)
    // No resolve buttons — patient cannot modify tasks
    await expect(page.locator('button', { hasText: 'Resolve' })).toHaveCount(0)
  })

  test('patient cannot navigate to coordinator routes', async ({ page }) => {
    await page.goto(`/dashboard/${TEST_PATIENT_ID}`)
    // Should redirect to patient view or show 403
    await expect(page).not.toHaveURL(/\/dashboard/)
  })
})
```

```typescript
// __tests__/e2e/rls-enforcement.spec.ts
test.describe('Cross-user access prevention', () => {
  test('coordinator cannot access another coordinator patient dashboard', async ({ page }) => {
    // Log in as coordinator A
    await loginAs(page, 'coord-a@test.com')
    // Try to navigate to coordinator B's patient
    await page.goto(`/dashboard/${COORDINATOR_B_PATIENT_ID}`)
    // Must not load data — should show 404 or redirect
    await expect(page.locator('[data-testid=patient-name]')).not.toBeVisible()
  })
})
```

---

## CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm vitest run --exclude '**/__tests__/ai/fixture*' --exclude '**/__tests__/e2e/**'
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
      AI_MODEL_TIER: development

  e2e:
    runs-on: ubuntu-latest
    needs: unit-integration
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm start &
      - run: npx wait-on http://localhost:3000 --timeout 30000
      - run: pnpm exec playwright test
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
      BLOB_READ_WRITE_TOKEN: ${{ secrets.TEST_BLOB_TOKEN }}
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      AI_MODEL_TIER: development

  ai-fixtures:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'  # only on main — not every PR
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm vitest run __tests__/ai/fixture.test.ts __tests__/ai/boundary.test.ts
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      AI_MODEL_TIER: production
```

---

## Test Seed Data

All integration and E2E tests rely on consistent seed data. The seed script creates:
- 2 coordinator accounts: `coord-a@test.com`, `coord-b@test.com`
- 1 patient account: `patient@test.com`
- 1 patient record linked to coord-a and the patient user
- 1 active episode for that patient
- 1 pre-translated document in that episode
- 2 pending tasks (1 during_care, 1 post_discharge)

```bash
# Run once to set up the test Supabase project
pnpm tsx scripts/seed-test-db.ts
```

Seed data is deterministic — same UUIDs every run (use fixed seeds). Store the known IDs as constants in `__tests__/fixtures/seed-ids.ts`.

---

## Running Tests

```bash
# All fast tests (unit + integration, no real Claude, no browser)
pnpm test

# Watch mode during development
pnpm test:watch

# E2E only (requires dev server running)
pnpm test:e2e

# AI fixture tests (slow, costs money — run intentionally)
AI_MODEL_TIER=production pnpm test:ai

# Type check (run before commit)
pnpm tsc --noEmit
```

```json
// package.json scripts
{
  "test": "vitest run --exclude '**/__tests__/ai/fixture*' --exclude '**/__tests__/e2e/**'",
  "test:watch": "vitest --exclude '**/__tests__/ai/fixture*' --exclude '**/__tests__/e2e/**'",
  "test:e2e": "playwright test",
  "test:ai": "vitest run __tests__/ai/fixture.test.ts __tests__/ai/boundary.test.ts"
}
```

---

## Exit Criteria for the Test Suite

Before V1 ships, the following must pass:

- [ ] All unit tests pass (`pnpm test`)
- [ ] All 4 primitive components render without errors for all valid prop values
- [ ] RLS tests confirm coordinator isolation and patient read-only enforcement
- [ ] `upload-document` Server Action sets `status: translated` on success and `status: failed` on Claude error
- [ ] File validation rejects files over 10 MB and non-allowed MIME types before reaching Claude
- [ ] E2E: coordinator upload flow completes end-to-end on `localhost:3000`
- [ ] E2E: patient view shows no raw document access or write controls
- [ ] AI fixture test: prescription fixture produces non-empty `actions` with no raw medical abbreviations
- [ ] AI fixture test: bill fixture produces `actions: []`
- [ ] `pnpm tsc --noEmit` exits with zero errors
