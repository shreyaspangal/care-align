# Form Handling Contract

Every `'use client'` component that has a `<form>` and calls a server action must follow this exact pattern. All 7 rules must hold simultaneously.

Enforced by `pnpm lint:schemas` and the PostToolUse hook in `.claude/settings.json`.

---

## Required structure

```tsx
// 1. Import the matching schema — same one the action uses
import { LoginSchema } from '@/lib/validation/schemas'

// 2. Field-level error state — typed to the schema's keys
type FieldErrors = Partial<Record<'email' | 'password', string>>
const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

// 3. onSubmit guard — safeParse before the action fires
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  const result = LoginSchema.safeParse({ email, password })
  if (!result.success) {
    e.preventDefault()                          // block the server action
    const errs: FieldErrors = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FieldErrors
      if (!errs[field]) errs[field] = issue.message   // first error per field wins
    }
    setFieldErrors(errs)
    return
  }
  setFieldErrors({})                            // clear on valid submit
}

// 4. Wire it: onSubmit on the form, action still present for server fallback
<form action={action} onSubmit={handleSubmit}>

// 5. Clear field error on each keystroke for that field only
onChange={(e) => {
  setValue(e.target.value)
  setFieldErrors(p => ({ ...p, fieldName: undefined }))
}}

// 6. aria-invalid on the input — Shadcn Input styles respond to this automatically
<Input aria-invalid={!!fieldErrors.email} ... />

// 7. Inline error message directly under the field, not at the top of the form
{fieldErrors.email && (
  <p className="text-xs text-destructive">{fieldErrors.email}</p>
)}
```

## Why each rule exists

| Rule | Why |
|------|-----|
| Same schema client + server | One source of truth — change constraints once, both layers update |
| `e.preventDefault()` on failure | Never waste a server round-trip on input that will fail anyway |
| Per-field `FieldErrors` type | Users see exactly which field failed, not a generic top-level message |
| Clear on `onChange` | Error disappears as soon as the user starts fixing it — not on full reset |
| `aria-invalid` on input | Required for a11y; Shadcn's `Input` renders a red ring automatically when set |
| Server `state?.error` at top | Covers cases only the server can know: "email already taken", auth failures |
| `setFieldErrors({})` on clean parse | Stale errors don't persist into a valid submission |

## Server action side

Every `'use server'` action that reads `formData.get()` must either:
- Import from `@/lib/validation/schemas` and call `.safeParse()`, or
- Delegate to a schema-backed validator like `validateDocumentFile()`

All schemas live in `lib/validation/schemas.ts` — define there first, then write the action.

## Zod v4 notes

- Enum error messages: use `{ error: () => ({ message: '...' }) }`, not `errorMap`
- `z.string().trim()` strips whitespace before min-length check — always use on name fields
