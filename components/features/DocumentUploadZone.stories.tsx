import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DocumentUploadZone } from './DocumentUploadZone'

/**
 * Drop zone for medical document uploads.
 *
 * Three visible states:
 * - **Idle** — drag-and-drop target + click-to-browse, accepts PDF / JPG / PNG / HEIC ≤ 10 MB
 * - **Uploading** — spinner + file name; zone is non-interactive
 * - **Error** — inline error message + "Try again" resets to idle
 *
 * On success the zone immediately resets to idle and fires a `sonner` toast
 * (not a visible component state — verified in integration tests).
 */
const meta = {
  component: DocumentUploadZone,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    episodeId: 'episode-demo-001',
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
  },
}

// ─── Uploading ────────────────────────────────────────────────────────────────

/** Rendered directly to show the uploading state without triggering a real upload. */
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
      <Button variant="destructive" size="sm">
        Try again
      </Button>
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
      <Button variant="destructive" size="sm">
        Try again
      </Button>
    </div>
  ),
}

export const ErrorUploadFailed: Story = {
  name: 'Error — upload failed (server)',
  render: () => (
    <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="text-destructive" size={28} />
      <p className="text-sm font-medium text-destructive">File upload failed. Please try again.</p>
      <Button variant="destructive" size="sm">
        Try again
      </Button>
    </div>
  ),
}

// ─── DraggingActive ──────────────────────────────────────────────────────────

/** Visual snapshot of the drag-over highlight state. */
export const DragActive: Story = {
  name: 'Drag active',
  render: () => (
    <div
      className={cn(
        'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors',
        'border-primary bg-primary/5'
      )}
    >
      <Upload className="text-primary" size={28} />
      <div>
        <p className="text-sm font-medium">Drop a document here</p>
        <p className="text-xs text-muted-foreground mt-1">
          or <span className="underline underline-offset-4">browse files</span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG, HEIC · max 10 MB</p>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Drop a document here')).toBeVisible()
  },
}
