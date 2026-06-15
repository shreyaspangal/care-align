import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

const sizes: Record<LogoSize, { mark: number; text: string; gap: string; stroke: number }> = {
  sm: { mark: 16, text: 'text-logo-sm', gap: 'gap-1.5', stroke: 5 },
  md: { mark: 20, text: 'text-logo-md', gap: 'gap-2',   stroke: 4.5 },
  lg: { mark: 26, text: 'text-logo-lg', gap: 'gap-2.5', stroke: 4 },
}

type LogoProps = {
  size?: LogoSize
  className?: string
}

export function Logo({ size = 'md', className }: LogoProps) {
  const { mark, text, gap, stroke } = sizes[size]

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
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d="M32 16L37 11"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d="M32 16L37 21"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn('font-heading font-bold leading-none', text)}
        style={{ letterSpacing: '-0.025em' }}
      >
        <span className="text-brand-base">Care</span>
        <span className="text-foreground">Align</span>
      </span>
    </div>
  )
}
