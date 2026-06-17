'use client'

import { useState } from 'react'
import { ChevronUp, LogOut, Globe, Building2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LANGUAGES = [
  { code: 'en', label: 'English', available: true },
  { code: 'hi', label: 'Hindi',   available: false },
  { code: 'mr', label: 'Marathi', available: false },
  { code: 'ta', label: 'Tamil',   available: false },
  { code: 'te', label: 'Telugu',  available: false },
  { code: 'kn', label: 'Kannada', available: false },
]

type UserProfileMenuProps = {
  name: string
  email: string
  initial: string
  onLogout: () => Promise<void>
}

export function UserProfileMenu({ name, email, initial, onLogout }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn('w-full h-auto px-2 py-2 justify-start gap-2.5', open && 'bg-muted')}
        >
          <div className="w-7 h-7 rounded-full bg-brand-tint flex items-center justify-center text-brand-base text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-foreground truncate">{name}</p>
            <p className="text-2xs text-muted-foreground truncate">{email}</p>
          </div>
          <ChevronUp size={13} className={cn(
            'flex-shrink-0 text-muted-foreground transition-transform',
            open ? 'rotate-180' : ''
          )} />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-56 p-0 overflow-hidden"
      >
        {/* Workspace */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">My Workspace</p>
              <p className="text-2xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe size={12} className="text-muted-foreground" />
            <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">Language</p>
          </div>
          <div className="space-y-0.5">
            {LANGUAGES.map(lang => (
              <div
                key={lang.code}
                className={cn(
                  'flex items-center justify-between px-1.5 py-1 rounded text-xs',
                  lang.available
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground/50 cursor-not-allowed select-none'
                )}
              >
                <span>{lang.label}</span>
                {lang.available && <span className="w-1.5 h-1.5 rounded-full bg-brand-base" />}
                {!lang.available && <span className="text-2xs text-muted-foreground/40">Soon</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <form action={onLogout} className="p-1">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground"
          >
            <LogOut size={13} />
            Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
