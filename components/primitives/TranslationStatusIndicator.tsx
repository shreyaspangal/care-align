import { Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TranslationStatus } from '@/lib/types/domain'

type TranslationStatusIndicatorProps = {
  status: TranslationStatus
  onRetry?: () => void
}

const config: Record<
  TranslationStatus,
  { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; className: string; animate?: boolean }
> = {
  pending: { icon: Clock, label: 'Pending', className: 'text-gray-500' },
  translating: { icon: Loader2, label: 'Translating...', className: 'text-blue-600', animate: true },
  complete: { icon: CheckCircle, label: 'Translated', className: 'text-green-600' },
  failed: { icon: AlertTriangle, label: 'Failed — tap to retry', className: 'text-red-600' },
}

export function TranslationStatusIndicator({ status, onRetry }: TranslationStatusIndicatorProps) {
  const { icon: Icon, label, className, animate } = config[status]
  const isRetryable = status === 'failed' && onRetry

  const content = (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <Icon size={14} className={cn(animate && 'animate-spin')} />
      {label}
    </span>
  )

  if (isRetryable) {
    return (
      <button type="button" onClick={onRetry} className="hover:opacity-80 transition-opacity">
        {content}
      </button>
    )
  }

  return content
}
