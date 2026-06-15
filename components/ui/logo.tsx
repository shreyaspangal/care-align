import { cn } from '@/lib/utils'

type LogoSize    = 'sm' | 'md' | 'lg'
type LogoVariant = 'default' | 'light'

const sizes: Record<LogoSize, { mark: number; text: string; gap: string; stroke: number }> = {
  sm: { mark: 16, text: 'text-logo-sm', gap: 'gap-1.5', stroke: 5   },
  md: { mark: 20, text: 'text-logo-md', gap: 'gap-2',   stroke: 4.5 },
  lg: { mark: 26, text: 'text-logo-lg', gap: 'gap-2.5', stroke: 4   },
}

// default: teal mark + teal "Care" + foreground "Align" — for light backgrounds
// light:   teal mark + teal "Care" + background "Align" — for dark backgrounds
const variants: Record<LogoVariant, { mark: string; care: string; align: string }> = {
  default: { mark: 'var(--brand-base)', care: 'text-brand-base', align: 'text-foreground'  },
  light:   { mark: 'var(--brand-base)', care: 'text-brand-base', align: 'text-background'  },
}

type LogoProps = {
  size?:    LogoSize
  variant?: LogoVariant
  className?: string
}

export function Logo({ size = 'md', variant = 'default', className }: LogoProps) {
  const { mark, text, gap, stroke } = sizes[size]
  const v = variants[variant]

  return (
    <div className={cn('flex items-center', gap, className)}>
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <path
          d="M48 32C48 40.837 40.837 48 32 48C23.163 48 16 40.837 16 32C16 23.163 23.163 16 32 16"
          stroke={v.mark}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path d="M32 16L37 11" stroke={v.mark} strokeWidth={stroke} strokeLinecap="round" />
        <path d="M32 16L37 21" stroke={v.mark} strokeWidth={stroke} strokeLinecap="round" />
      </svg>
      <span
        className={cn('font-heading font-bold leading-none', text)}
        style={{ letterSpacing: '-0.025em' }}
      >
        <span className={v.care}>Care</span>
        <span className={v.align}>Align</span>
      </span>
    </div>
  )
}
