import {
  ShieldCheck,
  Pill,
  Stethoscope,
  Heart,
  FlaskConical,
  FileText,
  CreditCard,
} from 'lucide-react'

type TaskCategory =
  | 'insurance'
  | 'medication'
  | 'doctor_visit'
  | 'lifestyle'
  | 'test_results'
  | 'forms'
  | 'payment'

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
