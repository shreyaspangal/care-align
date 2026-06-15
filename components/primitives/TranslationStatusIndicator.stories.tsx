import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { TranslationStatusIndicator } from './TranslationStatusIndicator'

/**
 * Inline status indicator showing where a document is in the AI pipeline.
 *
 * Four states map to the `document_status` enum:
 * - `pending` — uploaded, not yet classified
 * - `translating` — classification done, translation in progress
 * - `complete` — translation stored in `document_translations`
 * - `failed` — any pipeline step threw; renders as a retry button
 *
 * `onRetry` is only wired when `status === 'failed'`. Passing `onRetry`
 * with any other status has no effect.
 */
const meta = {
  component: TranslationStatusIndicator,
  tags: ['ai-generated'],
  argTypes: {
    status: {
      control: 'radio',
      options: ['pending', 'translating', 'complete', 'failed'],
      description: 'Current pipeline status for this document',
    },
    onRetry: {
      description: 'Called when user taps the failed state. Only active when status=failed.',
    },
  },
} satisfies Meta<typeof TranslationStatusIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = { args: { status: 'pending' } }
export const Translating: Story = { args: { status: 'translating' } }
export const Complete: Story = { args: { status: 'complete' } }

export const Failed: Story = {
  args: { status: 'failed', onRetry: fn() },
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole('button')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveTextContent('Failed')
    // Clicking calls onRetry
    btn.click()
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const AllStates: Story = {
  name: 'All states',
  args: { status: 'pending' },
  render: () => (
    <div className="flex flex-col gap-3">
      <TranslationStatusIndicator status="pending" />
      <TranslationStatusIndicator status="translating" />
      <TranslationStatusIndicator status="complete" />
      <TranslationStatusIndicator status="failed" onRetry={() => {}} />
    </div>
  ),
}
