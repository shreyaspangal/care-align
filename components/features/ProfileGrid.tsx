'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { LockKeyhole, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProfileSummary } from '@/lib/dal/profiles'
import type { ProfileColor } from '@/lib/types/domain'

// Netflix-style picker. Presentational only — locked profiles still link to
// /p/[id]; the profile layout is the gate that redirects to /unlock (never
// trust the client to enforce the lock).

const colorClasses: Record<ProfileColor, string> = {
  accent: 'bg-accent-tint text-accent-base',
  brand: 'bg-brand-tint text-brand-base',
  ai: 'bg-ai-tint text-ai-base',
  success: 'bg-success-tint text-success-base',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

type ProfileGridProps = {
  profiles: ProfileSummary[]
}

export function ProfileGrid({ profiles }: ProfileGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {profiles.map((profile) => (
        <li key={profile.id} className="relative">
          <Link
            href={`/p/${profile.id}`}
            onClick={() =>
              posthog.capture('profile_selected', { is_pin_protected: profile.hasPin })
            }
            className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-brand-border"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-16 items-center justify-center rounded-full text-xl font-semibold',
                colorClasses[profile.color]
              )}
            >
              {initials(profile.name)}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {profile.name}
              {profile.hasPin && (
                <LockKeyhole aria-label="PIN protected" className="size-3.5 text-muted-foreground" />
              )}
            </span>
          </Link>
          <Link
            href={`/profiles/${profile.id}/edit`}
            aria-label={`Edit ${profile.name}`}
            className="absolute top-2 right-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </Link>
        </li>
      ))}
      <li>
        <Link
          href="/profiles/new"
          className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-muted-foreground transition-colors hover:border-brand-border hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-8" />
          <span className="text-sm font-medium">Add family member</span>
        </Link>
      </li>
    </ul>
  )
}
