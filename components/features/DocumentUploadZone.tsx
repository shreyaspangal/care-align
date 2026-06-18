'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2, ChevronsUpDown, Check, CheckCircle2, Circle, ArrowLeft, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type UploadHints,
} from '@/lib/validation/schemas'
import { validateDocumentFile } from '@/lib/storage/validate'

type UploadStage = 'uploading' | 'classifying' | 'translating' | 'summarising'

const PIPELINE_STAGES: { key: UploadStage; label: string; startAt: number }[] = [
  { key: 'uploading',   label: 'Uploading file',                startAt: 0  },
  { key: 'classifying', label: 'Classifying document',          startAt: 4  },
  { key: 'translating', label: 'Translating to plain language', startAt: 12 },
  { key: 'summarising', label: 'Updating episode summary',      startAt: 22 },
]

function getCurrentStage(elapsed: number): UploadStage {
  if (elapsed >= 22) return 'summarising'
  if (elapsed >= 12) return 'translating'
  if (elapsed >= 4)  return 'classifying'
  return 'uploading'
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; error: string }

type UploadResult = { ok: true; documentId: string } | { ok: false; error: string }

type DocumentUploadZoneProps = {
  episodeId: string
  onUpload: (episodeId: string, formData: FormData) => Promise<UploadResult>
  onUploadComplete?: (documentId: string) => void
}

const CUSTOM_TYPE_VALUE = '__custom__'
const PREDEFINED_TYPES = DOCUMENT_TYPES.filter(t => t !== 'other')

// ── Minimal types for Google Maps Places (New) API ─────────────────────────

type GooglePlaceSuggestion = {
  placePrediction: {
    placeId: string
    mainText: { text: string }
    secondaryText?: { text: string }
  }
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions(request: {
              input: string
              includedPrimaryTypes?: string[]
              includedRegionCodes?: string[]
            }): Promise<{ suggestions: GooglePlaceSuggestion[] }>
          }
        }
      }
    }
  }
}

async function fetchHospitalSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
  if (typeof window === 'undefined') return []
  const api = window.google?.maps?.places?.AutocompleteSuggestion
  if (!api || !input.trim()) return []
  try {
    const { suggestions } = await api.fetchAutocompleteSuggestions({
      input,
      includedPrimaryTypes: ['hospital'],
      includedRegionCodes: ['in'],
    })
    return suggestions
  } catch {
    return []
  }
}

// ── Hospital autocomplete sub-component ────────────────────────────────────

type HospitalAutocompleteProps = {
  value: string
  onChange: (value: string) => void
}

function HospitalAutocomplete({ value, onChange }: HospitalAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputValue(v)
    onChange(v)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const results = await fetchHospitalSuggestions(v)
      setSuggestions(results)
    }, 300)
  }

  function handleSelect(main: string) {
    setInputValue(main)
    onChange(main)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        placeholder="Auto-detected"
        value={inputValue}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        className="h-9 text-sm"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-elevated overflow-hidden">
          {suggestions.map(({ placePrediction: p }) => (
            <Button
              key={p.placeId}
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-none h-auto py-2 px-3 font-normal"
              onClick={() => handleSelect(p.mainText.text)}
            >
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-xs font-medium text-foreground">{p.mainText.text}</span>
                {p.secondaryText && (
                  <span className="text-2xs text-muted-foreground">{p.secondaryText.text}</span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function DocumentUploadZone({ episodeId, onUpload, onUploadComplete }: DocumentUploadZoneProps) {
  const router = useRouter()
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const [hints, setHints] = useState<UploadHints>({})
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Combobox state
  const [typeOpen, setTypeOpen] = useState(false)
  const [comboView, setComboView] = useState<'list' | 'custom'>('list')
  const [customTypeInput, setCustomTypeInput] = useState('')

  const selectedTypeLabel = hints.type === 'other' && hints.custom_type
    ? hints.custom_type
    : hints.type && hints.type !== 'other'
      ? DOCUMENT_TYPE_LABELS[hints.type as DocumentType]
      : null

  useEffect(() => {
    if (state.status !== 'uploading') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [state.status])

  async function handleFile(file: File) {
    const validation = validateDocumentFile(file)
    if (!validation.ok) {
      setState({ status: 'error', error: validation.error })
      return
    }

    setElapsed(0)
    setState({ status: 'uploading', fileName: file.name })

    const formData = new FormData()
    formData.append('file', file)
    if (hints.type) formData.append('hint_type', hints.type)
    if (hints.custom_type) formData.append('hint_custom_type', hints.custom_type)
    if (hints.source_hospital) formData.append('hint_source_hospital', hints.source_hospital)

    let result: UploadResult
    try {
      result = await onUpload(episodeId, formData)
    } catch {
      setState({ status: 'error', error: 'Upload failed. Please check your connection and try again.' })
      return
    }

    if (result.ok) {
      setState({ status: 'idle' })
      setHints({})
      setCustomTypeInput('')
      setComboView('list')
      toast.success(`${file.name} uploaded`, {
        description: 'AI classification is running in the background.',
        duration: 5000,
      })
      router.refresh()
      onUploadComplete?.(result.documentId)
    } else {
      setState({ status: 'error', error: result.error })
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  function selectType(value: string) {
    if (value === CUSTOM_TYPE_VALUE) {
      setComboView('custom')
      setCustomTypeInput('')
    } else {
      setHints(h => ({ ...h, type: value as DocumentType, custom_type: undefined }))
      setTypeOpen(false)
      setComboView('list')
    }
  }

  function confirmCustomType() {
    if (customTypeInput.trim()) {
      setHints(h => ({ ...h, type: 'other', custom_type: customTypeInput.trim() }))
    }
    setTypeOpen(false)
    setComboView('list')
  }

  function clearType() {
    setHints(h => ({ ...h, type: undefined, custom_type: undefined }))
    setCustomTypeInput('')
    setComboView('list')
  }

  const acceptTypes = ALLOWED_MIME_TYPES.join(',')
  const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024)

  if (state.status === 'uploading') {
    const currentStage = getCurrentStage(elapsed)
    const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStage)

    return (
      <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center gap-4 bg-primary/5">
        <Loader2 className="animate-spin text-primary" size={24} />
        <div className="w-full max-w-xs space-y-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone = i < currentIdx
            const isCurrent = i === currentIdx
            return (
              <div key={stage.key} className="flex items-center gap-2.5">
                {isDone ? (
                  <CheckCircle2 size={15} className="text-primary shrink-0" />
                ) : isCurrent ? (
                  <Loader2 size={15} className="animate-spin text-primary shrink-0" />
                ) : (
                  <Circle size={15} className="text-muted-foreground/30 shrink-0" />
                )}
                <span className={cn(
                  'text-sm',
                  isCurrent ? 'font-medium text-foreground' : isDone ? 'text-muted-foreground line-through' : 'text-muted-foreground/50'
                )}>
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{state.fileName} · usually 20–30 seconds</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="text-destructive" size={28} />
        <p className="text-sm font-medium text-destructive">{state.error}</p>
        <Button variant="destructive" size="sm" onClick={() => setState({ status: 'idle' })}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Hint fields */}
      <div className="grid grid-cols-2 gap-3">

        {/* Document type — Combobox */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Document type <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <Popover open={typeOpen} onOpenChange={(o) => { setTypeOpen(o); if (!o) setComboView('list') }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={typeOpen}
                className="w-full h-9 justify-between font-normal text-sm px-3"
              >
                <span className={selectedTypeLabel ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedTypeLabel ?? 'Auto-detected'}
                </span>
                <ChevronsUpDown size={13} className="text-muted-foreground shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              {comboView === 'list' ? (
                <Command>
                  <CommandInput placeholder="Search type…" className="h-8 text-sm" />
                  <CommandList>
                    <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                      No match.
                    </CommandEmpty>
                    <CommandGroup>
                      {PREDEFINED_TYPES.map(t => (
                        <CommandItem
                          key={t}
                          value={t}
                          onSelect={() => selectType(t)}
                          className="text-sm"
                        >
                          <Check
                            size={13}
                            className={cn('mr-2 shrink-0', hints.type === t ? 'opacity-100' : 'opacity-0')}
                          />
                          {DOCUMENT_TYPE_LABELS[t]}
                        </CommandItem>
                      ))}
                      {/* Other is part of the main list */}
                      <CommandItem
                        value={CUSTOM_TYPE_VALUE}
                        onSelect={() => selectType(CUSTOM_TYPE_VALUE)}
                        className="text-sm"
                      >
                        <Check
                          size={13}
                          className={cn('mr-2 shrink-0', hints.type === 'other' ? 'opacity-100' : 'opacity-0')}
                        />
                        Other (custom)…
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                  {/* Clear selection — anchored at bottom, always visible */}
                  <div className="border-t p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!hints.type}
                      onClick={clearType}
                      className="w-full justify-start h-8 text-xs text-muted-foreground gap-1.5"
                    >
                      <X size={11} />
                      Clear selection
                    </Button>
                  </div>
                </Command>
              ) : (
                /* Inline custom type input */
                <div className="p-3 space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setComboView('list')}
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent gap-1"
                  >
                    <ArrowLeft size={12} /> Back
                  </Button>
                  <p className="text-xs font-medium text-foreground">Custom document type</p>
                  <Input
                    autoFocus
                    placeholder="e.g. Referral Letter"
                    value={customTypeInput}
                    onChange={e => setCustomTypeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmCustomType()}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={confirmCustomType}
                    disabled={!customTypeInput.trim()}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Hospital — Google Places autocomplete, falls back to plain input */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Hospital <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <HospitalAutocomplete
            value={hints.source_hospital ?? ''}
            onChange={v => setHints(h => ({ ...h, source_hospital: v || undefined }))}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload document"
        className={cn(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/30'
        )}
      >
        <Upload className="text-muted-foreground" size={28} />
        <div>
          <p className="text-sm font-medium">Drop a document here</p>
          <p className="text-xs text-muted-foreground mt-1">
            or <span className="underline underline-offset-4">browse files</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG, HEIC · max {maxMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>
    </div>
  )
}
