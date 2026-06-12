import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'
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
 */
const meta = {
  component: DocumentUploadZone,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { episodeId: 'episode-demo-001' },
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

// ─── Uploading ────────────────────────────────────────────────────────────────

export const Uploading: Story = {
  render: () => (
    <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 flex flex-col items-center gap-3 text-center bg-primary/5">
      <Loader2 className="animate-spin text-primary" size={28} />
      <div>
        <p className="text-sm font-medium">Uploading discharge_summary.pdf</p>
        <p className="text-xs text-muted-foreground mt-0.5">Please wait…</p>
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Uploading discharge_summary.pdf')).toBeVisible()
    await expect(canvas.getByText('Please wait…')).toBeVisible()
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
