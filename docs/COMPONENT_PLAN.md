# Patient Coordinator — Component Plan

> Components are defined before they are built. AI assembles from these primitives — it does not generate UI from scratch. This prevents inconsistency and reduces token waste.

---

## The Principle (from Guillermo Rauch)

Do not ask AI to generate a component from scratch every time. Define your primitive building blocks first. Then ask AI to compose features from those primitives.

This produces:
- Consistent UI across the product
- Faster builds (AI works with known constraints)
- Lower token cost (less generation, more composition)
- Easier maintenance (one primitive to update, not ten scattered implementations)

---

## Layer 1 — Primitives

Atomic components. Never AI-generated from scratch. Built once, used everywhere.

### DocumentTypeTag
Displays the type of a document as a coloured label.

```tsx
// Props
type DocumentTypeTagProps = {
  type: 'prescription' | 'lab_report' | 'discharge_summary' |
        'bill' | 'observation_note' | 'other'
  size?: 'sm' | 'md'
}

// Visual treatment (Tailwind)
prescription:       bg-blue-50   text-blue-700   border-blue-200
lab_report:         bg-purple-50 text-purple-700 border-purple-200
discharge_summary:  bg-green-50  text-green-700  border-green-200
bill:               bg-amber-50  text-amber-700  border-amber-200
observation_note:   bg-slate-50  text-slate-700  border-slate-200
other:              bg-gray-50   text-gray-600   border-gray-200

// Display labels
prescription:       "Prescription"
lab_report:         "Lab Report"
discharge_summary:  "Discharge Summary"
bill:               "Bill"
observation_note:   "Observation Note"
other:              "Document"
```

---

### EpisodeStatusBadge
Displays current episode status as a coloured badge with a dot indicator.

```tsx
type EpisodeStatusBadgeProps = {
  status: 'active' | 'care_complete' | 'closed'
}

active:         green dot  + "Active"
care_complete:  amber dot  + "Care Complete"
closed:         gray dot   + "Closed"
```

---

### TaskCategoryIcon
Icon representing a pending task category.

```tsx
type TaskCategoryIconProps = {
  category: 'insurance' | 'medication' | 'doctor_visit' |
            'lifestyle' | 'test_results' | 'forms' | 'payment'
  size?: number  // default 16
}

// Use Lucide icons
insurance:    ShieldCheck
medication:   Pill
doctor_visit: Stethoscope
lifestyle:    Heart
test_results: FlaskConical
forms:        FileText
payment:      CreditCard
```

---

### TranslationStatusIndicator
Shows whether a document has been translated yet.

```tsx
type TranslationStatusIndicatorProps = {
  status: 'pending' | 'translating' | 'complete' | 'failed'
}

pending:     gray  clock icon    "Pending"
translating: blue  spinner       "Translating..."
complete:    green check icon    "Translated"
failed:      red   alert icon    "Failed — tap to retry"
```

---

## Layer 2 — Composites

Assembled from primitives. Each composite uses only primitives from Layer 1 and base Shadcn components.

### DocumentCard
Single document entry in the episode timeline.

```tsx
type DocumentCardProps = {
  document: {
    id: string
    name: string
    type: DocumentType
    purpose: string | null   // null while status = pending_classification
    document_date: string | null  // null when Claude cannot extract a date
    translation_status: TranslationStatus
  }
  onClick?: () => void
}

// Null handling rules:
// document_date null  → render "Date unknown" in muted gray text (never hide the slot)
// purpose null        → render "Processing..." in muted gray text
// Do not default document_date to upload date — it would be factually wrong.

// Layout
┌─────────────────────────────────────────┐
│ [DocumentTypeTag]          [date | "Date unknown"]  │
│ Document name                            │
│ Purpose label | "Processing..."          │
│                   [TranslationStatus]    │
└─────────────────────────────────────────┘
```

---

### PendingTaskRow
Single pending task in the task list.

```tsx
type PendingTaskRowProps = {
  task: {
    id: string
    category: TaskCategory
    description: string
    status: TaskStatus
    phase_appears: TaskPhase
  }
  onResolve?: (id: string) => void
}

// Layout
┌─────────────────────────────────────────┐
│ [TaskCategoryIcon] Description text      │
│                          [Resolve btn]   │
└─────────────────────────────────────────┘
```

---

### EpisodeStatusCard
Summary header showing current episode status.

```tsx
type EpisodeStatusCardProps = {
  summary: {
    status_label: string
    status_description: string
    version: number
    updated_at: string
  }
  episodeStatus: EpisodeStatus
}

// Layout
┌─────────────────────────────────────────┐
│ [EpisodeStatusBadge]    Last updated X  │
│ Status label (large)                     │
│ Status description (body text)           │
└─────────────────────────────────────────┘
```

---

## Layer 3 — Features

Full product sections assembled from composites and primitives.

### EpisodeTimeline
The main coordinator view — chronological list of all documents.

```tsx
type EpisodeTimelineProps = {
  episodeId: string
}

// Behaviour
- Fetches all documents for episode
- Sort order: document_date ASC NULLS LAST, created_at ASC
  → Documents with a known date are sorted chronologically
  → Documents with no extractable date appear at the end, sorted by upload time
  → This is explicit — do not let Postgres default decide
- Groups by date if multiple documents on same day (null-date documents grouped as "Date unknown")
- Each document renders as DocumentCard
- Empty state: "No documents yet — upload the first one"
- Click on DocumentCard → opens TranslationOutputPanel
```

---

### DocumentUploadZone
Upload area for new documents with optional pre-classification hints.

```tsx
// Behaviour
- Two optional hint fields above the drop zone:
    1. Document type — dropdown of 6 enum values + "Other (custom)"
       Custom maps to type='other', custom label stored in purpose
    2. Hospital name — free text input
    Both are advisory — Claude confirms or corrects after classification.
    Hints are seeded into the documents row immediately on upload
    so the UI shows something while AI runs.
- Drag and drop OR file picker
- Accepts: PDF, JPG, PNG, HEIC
- Max size: 10MB
- On upload:
    1. Appends hints to FormData (hint_type, hint_custom_type, hint_source_hospital)
    2. Shows upload progress
    3. Calls upload-document server action
    4. On complete → resets hints, fires onUploadComplete(documentId)
- Error state: clear message + retry button
```

---

### DocumentClassificationEditor
Inline edit UI for post-classification corrections. Shown inside DocumentCard
when coordinator spots a discrepancy between their hint and Claude's output.

```tsx
type DocumentClassificationEditorProps = {
  documentId: string
  current: {
    type: DocumentType
    purpose: string | null
    source_hospital: string | null
    source_department: string | null
    document_date: string | null
  }
  onSaved?: (updated: ClassificationFields) => void
}

// Behaviour
- View mode: shows DocumentTypeTag + purpose + hospital with pencil edit button
- Edit mode (on pencil click): inline form with all 5 editable fields
  Fields: type (select), purpose, source_hospital, source_department, document_date
- Save calls updateDocumentClassification server action — RLS enforces coordinator-only
- Cancel reverts to current values
- On save success: calls onSaved(updated), returns to view mode
```

---

### TranslationOutputPanel
The translated output for a single document. Shown on document click.

```tsx
// Behaviour
- Slides in as a sheet (Shadcn Sheet component)
- Shows: plain_language, what_it_means, actions list
- Actions rendered as PendingTaskRow items (read-only in this view)
- Coordinator view: shows all fields
- Patient view: shows plain_language only (no raw document access)
```

---

### EpisodeSummaryPanel
The living episode summary — shown at top of coordinator dashboard.

```tsx
// Behaviour
- Shows EpisodeStatusCard
- Shows visit_purpose
- Shows timeline_summary (collapsible if long)
- Shows open PendingTasks count by category
- Updates when EpisodeSummary.updated_at changes
```

---

## Build Order

Build primitives first. Do not build composites until all required primitives exist. Do not build features until all required composites exist.

```
Day 2 morning: All 4 primitives built and visually verified
Day 2 afternoon: All 3 composites assembled from primitives
Day 3+: Features assembled from composites
```

When asking AI to build a composite or feature, always include:
```
"Use only these existing primitives: [list]. 
Do not create new primitive components."
```

---

## Server Action Injection Pattern

**Rule:** Client components must never import server actions directly. Server actions are injected as props by the parent RSC page or layout.

**Why this exists:** `'use server'` files import `next/cache`, `next/headers`, Supabase server clients, and other Node-only modules. When a client component imports one directly, Vite's ESM bundler (used by Storybook and the test runner) pulls in the full server import tree, which contains CJS constructs (`__dirname`, `createRequire`) that crash in a browser environment. The crash happens at bundle time — no alias or config workaround is reliable.

**The pattern:**

```tsx
// ✗ Wrong — component imports the server action directly
import { uploadDocument } from '@/actions/upload-document'

export function DocumentUploadZone({ episodeId }) {
  await uploadDocument(episodeId, formData)
}

// ✓ Correct — action is injected as a prop
type UploadResult = { ok: true; documentId: string } | { ok: false; error: string }

type Props = {
  episodeId: string
  onUpload: (episodeId: string, formData: FormData) => Promise<UploadResult>
}

export function DocumentUploadZone({ episodeId, onUpload }: Props) {
  await onUpload(episodeId, formData)
}
```

**In the RSC page (production):** Pass the real server action.
```tsx
// app/(coordinator)/dashboard/[patientId]/page.tsx
import { uploadDocument } from '@/actions/upload-document'

<DocumentUploadZone episodeId={episode.id} onUpload={uploadDocument} />
```

**In stories (tests):** Pass `fn()` from `storybook/test`.
```tsx
import { fn } from 'storybook/test'

const meta = {
  args: {
    onUpload: fn().mockResolvedValue({ ok: true, documentId: 'doc-001' }),
  },
}
```

`fn()` records calls in the Storybook Actions panel and is inspectable in `play` functions via `expect(args.onUpload).toHaveBeenCalled()`.

**Applies to:** Any client component (`'use client'`) that needs to call a server action. The component receives the action as a typed prop — it has no knowledge of which action it calls or what modules that action imports.
