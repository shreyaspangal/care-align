import type { Metadata } from 'next'
import { register } from '@/actions/auth'
import { RegisterForm } from '@/components/features/RegisterForm'

export const metadata: Metadata = { title: 'Create account — CareAlign' }

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Create your family account</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        One account for the whole family — add everyone as profiles after this.
      </p>
      <RegisterForm action={register} />
    </>
  )
}
