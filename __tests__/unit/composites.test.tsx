import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { DocumentCard } from '@/components/composites/DocumentCard'
import { PendingTaskRow } from '@/components/composites/PendingTaskRow'
import { EpisodeStatusCard } from '@/components/composites/EpisodeStatusCard'

// ─── DocumentCard ─────────────────────────────────────────────────────────────

const baseDocument = {
  id: 'doc-1',
  name: 'Blood Test Report',
  type: 'lab_report' as const,
  purpose: 'Routine CBC panel',
  document_date: '2024-06-01',
  translation_status: 'complete' as const,
}

describe('DocumentCard', () => {
  it('renders document name', () => {
    render(<DocumentCard document={baseDocument} />)
    expect(screen.getByText('Blood Test Report')).toBeInTheDocument()
  })

  it('renders document type tag', () => {
    render(<DocumentCard document={baseDocument} />)
    expect(screen.getByText('Lab Report')).toBeInTheDocument()
  })

  it('renders purpose when provided', () => {
    render(<DocumentCard document={baseDocument} />)
    expect(screen.getByText('Routine CBC panel')).toBeInTheDocument()
  })

  it('renders "Processing..." when purpose is null', () => {
    render(<DocumentCard document={{ ...baseDocument, purpose: null }} />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('renders document_date with label when provided', () => {
    render(<DocumentCard document={baseDocument} />)
    expect(screen.getByText(/Issued at:/)).toBeInTheDocument()
  })

  it('renders "Unknown" label when document_date is null', () => {
    render(<DocumentCard document={{ ...baseDocument, document_date: null }} />)
    expect(screen.getByText(/Issued at:/)).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup()
    let called = false
    render(<DocumentCard document={baseDocument} onClick={() => { called = true }} />)
    await user.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })
})

// ─── PendingTaskRow ───────────────────────────────────────────────────────────

const baseTask = {
  id: 'task-1',
  category: 'medication' as const,
  description: 'Collect discharge prescription from pharmacy',
  status: 'open' as const,
  phase_appears: 'during_care' as const,
}

describe('PendingTaskRow', () => {
  it('renders task description', () => {
    render(<PendingTaskRow task={baseTask} />)
    expect(screen.getByText('Collect discharge prescription from pharmacy')).toBeInTheDocument()
  })

  it('renders resolve button for open tasks when onResolve provided', () => {
    render(<PendingTaskRow task={baseTask} onResolve={() => {}} />)
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  it('does not render resolve button when onResolve not provided', () => {
    render(<PendingTaskRow task={baseTask} />)
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
  })

  it('does not render resolve button for resolved tasks', () => {
    render(<PendingTaskRow task={{ ...baseTask, status: 'resolved' }} onResolve={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
  })

  it('calls onResolve with task id when clicked', async () => {
    const user = userEvent.setup()
    let resolvedId = ''
    render(<PendingTaskRow task={baseTask} onResolve={(id) => { resolvedId = id }} />)
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(resolvedId).toBe('task-1')
  })
})

// ─── EpisodeStatusCard ────────────────────────────────────────────────────────

const baseSummary = {
  status_label: 'Post-surgery recovery',
  status_description: 'Patient is recovering well. Vitals are stable.',
  version: 3,
  updated_at: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 min ago
}

describe('EpisodeStatusCard', () => {
  it('renders status label', () => {
    render(<EpisodeStatusCard summary={baseSummary} episodeStatus="active" />)
    expect(screen.getByText('Post-surgery recovery')).toBeInTheDocument()
  })

  it('renders status description', () => {
    render(<EpisodeStatusCard summary={baseSummary} episodeStatus="active" />)
    expect(screen.getByText('Patient is recovering well. Vitals are stable.')).toBeInTheDocument()
  })

  it('renders episode status badge', () => {
    render(<EpisodeStatusCard summary={baseSummary} episodeStatus="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders care_complete badge correctly', () => {
    render(<EpisodeStatusCard summary={baseSummary} episodeStatus="care_complete" />)
    expect(screen.getByText('Care Complete')).toBeInTheDocument()
  })

  it('renders relative time for updated_at', () => {
    render(<EpisodeStatusCard summary={baseSummary} episodeStatus="active" />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })
})
