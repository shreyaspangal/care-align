import { login } from '@/actions/auth'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return <LoginForm onLogin={login} />
}
