import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { fn } from 'storybook/test'
import { DeleteDocumentButton } from './DeleteDocumentButton'
import type { DocumentActionResult } from '@/actions/documents'

const succeed: () => Promise<DocumentActionResult> = async () => ({ success: true })
const fail: () => Promise<DocumentActionResult> = async () => ({
  success: false,
  error: 'Could not delete the document',
})

const meta = {
  title: 'Features/DeleteDocumentButton',
  component: DeleteDocumentButton,
  // Uses next/navigation's useRouter (Next 16 App Router) for the
  // post-delete redirect — required whenever a story renders it.
  parameters: {
    nextjs: { appDirectory: true },
  },
  args: {
    documentId: 'doc-1',
    profileId: 'profile-1',
    deleteDocument: fn(succeed),
  },
} satisfies Meta<typeof DeleteDocumentButton>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const ConfirmDialogOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete document' }))
    const dialog = within(document.body)
    await expect(dialog.getByText('Delete this document?')).toBeInTheDocument()
  },
}

export const DeleteFails: Story = {
  args: {
    deleteDocument: fn(fail),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete document' }))
    const dialog = within(document.body)
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }))
    // Dialog stays open on failure — nothing to assert on close, just that
    // the confirm button is still reachable (no crash, no silent redirect).
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  },
}
