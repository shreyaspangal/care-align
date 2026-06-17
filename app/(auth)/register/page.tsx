import { register } from '@/actions/auth'
import { RegisterForm } from './RegisterForm'

export default function RegisterPage() {
  return <RegisterForm onRegister={register} />
}
