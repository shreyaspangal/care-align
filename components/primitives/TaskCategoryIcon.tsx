import {
  ShieldCheck,
  Pill,
  Stethoscope,
  Heart,
  FlaskConical,
  FileText,
  CreditCard,
} from 'lucide-react'
import type { TaskCategory } from '@/lib/types/domain'

type TaskCategoryIconProps = {
  category: TaskCategory
  size?: number
}

const icons: Record<TaskCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  insurance: ShieldCheck,
  medication: Pill,
  doctor_visit: Stethoscope,
  lifestyle: Heart,
  test_results: FlaskConical,
  forms: FileText,
  payment: CreditCard,
}

export function TaskCategoryIcon({ category, size = 16 }: TaskCategoryIconProps) {
  const Icon = icons[category]
  return <Icon size={size} className="text-muted-foreground shrink-0" />
}
