import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { Upload, AlertCircle, Loader2, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DocumentUploadZone } from './DocumentUploadZone'

/**
 * Drop zone for medical document uploads.
 *
 * Two optional hint fields above the drop zone let the coordinator
 * pre-classify document type and hospital before upload. Both are advisory —
 * Claude confirms or corrects them after classification runs.
 *
 * Four visible states:
 * - **Idle** — hint fields + drag-and-drop target + click-to-browse
 * - **Uploading** — spinner + file name; zone is non-interactive
 * - **Error** — inline error message + "Try again" resets to idle
 * - **Custom type** — "Other (custom)" selected, text field appears
 *
 * NOTE: `onUpload` is injected by the parent RSC page (prop injection pattern).
 * Stories use `fn()` — never import server actions directly in components.
 * See docs/COMPONENT_PLAN.md for the canonical pattern.
 */
const meta = {
  component: DocumentUploadZone,
  tags: ['autodocs'],
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  args: {
    episodeId: 'episode-demo-001',
    // fn() replaces the real server action — records calls in the Actions panel.
    // The real action is injected by the RSC page in production.
    onUpload: fn().mockResolvedValue({ ok: true, documentId: 'doc-preview-001' }),
  },
} satisfies Meta<typeof DocumentUploadZone>

export default meta
type Story = StoryObj<typeof meta>

// ─── Idle (default) ──────────────────────────────────────────────────────────

export const Idle: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Drop a document here')).toBeVisible()
    await expect(canvas.getByText(/browse files/i)).toBeVisible()
    await expect(canvas.getByText(/PDF, JPG, PNG, HEIC/i)).toBeVisible()
    // Hint fields are present
    await expect(canvas.getByPlaceholderText('AI will detect')).toBeVisible()
  },
}

// ─── With hints pre-filled ───────────────────────────────────────────────────

export const HintsPrefilled: Story = {
  name: 'Hints pre-filled',
  play: async ({ canvas }) => {
    const typeSelect = canvas.getByRole('combobox')
    await userEvent.selectOptions(typeSelect, 'prescription')

    const hospitalInputs = canvas.getAllByPlaceholderText('AI will detect')
    await userEvent.type(hospitalInputs[0], 'Apollo Hospitals')

    await expect(typeSelect).toHaveValue('prescription')
  },
}

// ─── Custom type ─────────────────────────────────────────────────────────────

export const CustomType: Story = {
  name: 'Custom document type',
  play: async ({ canvas }) => {
    const typeSelect = canvas.getByRole('combobox')
    await userEvent.selectOptions(typeSelect, '__custom__')
    await expect(canvas.getByPlaceholderText('e.g. Referral Letter')).toBeVisible()
    await userEvent.type(canvas.getByPlaceholderText('e.g. Referral Letter'), 'Referral Letter')
  },
}

// ─── Uploading — stage 1: uploading file ─────────────────────────────────────

export const Uploading: Story = {
  name: 'Uploading — stage 1: uploading file',
  render: () => (
    <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center gap-4 bg-primary/5">
      <Loader2 className="animate-spin text-primary" size={24} />
      <div className="w-full max-w-xs space-y-2">
        {[
          { label: 'Uploading file',                state: 'current' },
          { label: 'Classifying document',          state: 'pending' },
          { label: 'Translating to plain language', state: 'pending' },
          { label: 'Updating episode summary',      state: 'pending' },
        ].map(({ label, state }) => (
          <div key={label} className="flex items-center gap-2.5">
            {state === 'done'    ? <CheckCircle2 size={15} className="text-primary shrink-0" /> :
             state === 'current' ? <Loader2 size={15} className="animate-spin text-primary shrink-0" /> :
                                   <Circle size={15} className="text-muted-foreground/30 shrink-0" />}
            <span className={cn(
              'text-sm',
              state === 'current' ? 'font-medium text-foreground' :
              state === 'done'    ? 'text-muted-foreground line-through' :
                                    'text-muted-foreground/50'
            )}>{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">discharge_summary.pdf · usually 20–30 seconds</p>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Uploading file')).toBeVisible()
    await expect(canvas.getByText('discharge_summary.pdf · usually 20–30 seconds')).toBeVisible()
  },
}

export const UploadingClassifying: Story = {
  name: 'Uploading — stage 2: classifying',
  render: () => (
    <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center gap-4 bg-primary/5">
      <Loader2 className="animate-spin text-primary" size={24} />
      <div className="w-full max-w-xs space-y-2">
        {[
          { label: 'Uploading file',                state: 'done' },
          { label: 'Classifying document',          state: 'current' },
          { label: 'Translating to plain language', state: 'pending' },
          { label: 'Updating episode summary',      state: 'pending' },
        ].map(({ label, state }) => (
          <div key={label} className="flex items-center gap-2.5">
            {state === 'done'    ? <CheckCircle2 size={15} className="text-primary shrink-0" /> :
             state === 'current' ? <Loader2 size={15} className="animate-spin text-primary shrink-0" /> :
                                   <Circle size={15} className="text-muted-foreground/30 shrink-0" />}
            <span className={cn(
              'text-sm',
              state === 'current' ? 'font-medium text-foreground' :
              state === 'done'    ? 'text-muted-foreground line-through' :
                                    'text-muted-foreground/50'
            )}>{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">discharge_summary.pdf · usually 20–30 seconds</p>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Classifying document')).toBeVisible()
  },
}

// ─── Error ────────────────────────────────────────────────────────────────────

export const ErrorFileTooLarge: Story = {
  name: 'Error — file too large',
  render: () => (
    <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="text-destructive" size={28} />
      <p className="text-sm font-medium text-destructive">File is too large. Maximum size is 10 MB.</p>
      <Button variant="destructive" size="sm">Try again</Button>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('File is too large. Maximum size is 10 MB.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeVisible()
  },
}

export const ErrorUnsupportedType: Story = {
  name: 'Error — unsupported file type',
  render: () => (
    <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="text-destructive" size={28} />
      <p className="text-sm font-medium text-destructive">
        File type not supported. Upload a PDF, JPG, PNG, or HEIC file.
      </p>
      <Button variant="destructive" size="sm">Try again</Button>
    </div>
  ),
}

export const ErrorUploadFailed: Story = {
  name: 'Error — upload failed (server)',
  render: () => (
    <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="text-destructive" size={28} />
      <p className="text-sm font-medium text-destructive">File upload failed. Please try again.</p>
      <Button variant="destructive" size="sm">Try again</Button>
    </div>
  ),
}

// ─── Drag active ─────────────────────────────────────────────────────────────

export const DragActive: Story = {
  name: 'Drag active',
  render: () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
        <div className="h-9 rounded-md border border-input bg-background" />
        <div className="h-9 rounded-md border border-input bg-background" />
      </div>
      <div className={cn(
        'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors',
        'border-primary bg-primary/5'
      )}>
        <Upload className="text-primary" size={28} />
        <div>
          <p className="text-sm font-medium">Drop a document here</p>
          <p className="text-xs text-muted-foreground mt-1">
            or <span className="underline underline-offset-4">browse files</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG, HEIC · max 10 MB</p>
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Drop a document here')).toBeVisible()
  },
}
