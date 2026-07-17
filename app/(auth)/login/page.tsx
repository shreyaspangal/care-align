import type { Metadata } from 'next'
import { login } from '@/actions/auth'
import { LoginForm } from '@/components/features/LoginForm'

export const metadata: Metadata = { title: 'Log in — CareAlign' }

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Log in</h1>
      <LoginForm action={login} />
    </>
  )
}
