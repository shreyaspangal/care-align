import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { EpisodeStatusBadge } from '@/components/primitives/EpisodeStatusBadge'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'

// ─── DocumentTypeTag ───────────────────────────────────────────────────────────

describe('DocumentTypeTag', () => {
  const types = [
    ['prescription', 'Prescription'],
    ['lab_report', 'Lab Report'],
    ['discharge_summary', 'Discharge Summary'],
    ['bill', 'Bill'],
    ['observation_note', 'Observation Note'],
    ['other', 'Other'],
  ] as const

  it.each(types)('renders label for type=%s', (type, label) => {
    render(<DocumentTypeTag type={type} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders sm size by default', () => {
    render(<DocumentTypeTag type="prescription" />)
    expect(screen.getByText('Prescription')).toBeInTheDocument()
  })

  it('renders md size', () => {
    render(<DocumentTypeTag type="bill" size="md" />)
    expect(screen.getByText('Bill')).toBeInTheDocument()
  })
})

// ─── EpisodeStatusBadge ────────────────────────────────────────────────────────

describe('EpisodeStatusBadge', () => {
  it('renders Active for active status', () => {
    render(<EpisodeStatusBadge status="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders Care Complete for care_complete status', () => {
    render(<EpisodeStatusBadge status="care_complete" />)
    expect(screen.getByText('Care Complete')).toBeInTheDocument()
  })

  it('renders Closed for closed status', () => {
    render(<EpisodeStatusBadge status="closed" />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })
})

// ─── TaskCategoryIcon ─────────────────────────────────────────────────────────

describe('TaskCategoryIcon', () => {
  const categories = [
    'insurance',
    'medication',
    'doctor_visit',
    'lifestyle',
    'test_results',
    'forms',
    'payment',
  ] as const

  it.each(categories)('renders without error for category=%s', (category) => {
    const { container } = render(<TaskCategoryIcon category={category} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('accepts custom size', () => {
    const { container } = render(<TaskCategoryIcon category="medication" size={24} />)
    expect(container.firstChild).not.toBeNull()
  })
})

// ─── TranslationStatusIndicator ───────────────────────────────────────────────

describe('TranslationStatusIndicator', () => {
  it('renders Pending', () => {
    render(<TranslationStatusIndicator status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders Translating...', () => {
    render(<TranslationStatusIndicator status="translating" />)
    expect(screen.getByText('Translating...')).toBeInTheDocument()
  })

  it('renders Translated for complete', () => {
    render(<TranslationStatusIndicator status="complete" />)
    expect(screen.getByText('Translated')).toBeInTheDocument()
  })

  it('renders failed state with retry text', () => {
    render(<TranslationStatusIndicator status="failed" />)
    expect(screen.getByText('Failed — tap to retry')).toBeInTheDocument()
  })

  it('calls onRetry when failed and clicked', async () => {
    const user = userEvent.setup()
    let called = false
    render(<TranslationStatusIndicator status="failed" onRetry={() => { called = true }} />)
    await user.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })

  it('does not render a button when status is complete', () => {
    render(<TranslationStatusIndicator status="complete" onRetry={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
