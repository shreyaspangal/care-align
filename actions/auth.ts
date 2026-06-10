'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginSchema, RegisterSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('auth')

export type AuthState = { error: string } | null

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { email: formData.get('email'), password: formData.get('password') }
  log.debug('login', 'validating input', { email: raw.email })

  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    log.warn('login', 'sign-in failed', { code: (error as { code?: string }).code })
    return { error: 'Incorrect email or password. Please try again.' }
  }

  log.info('login', 'sign-in successful', { email: parsed.data.email })
  redirect('/dashboard')
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  }
  log.debug('register', 'validating input', { email: raw.email, role: raw.role })

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // name and role picked up by handle_new_user trigger to create profiles row
      data: { name: parsed.data.name, role: parsed.data.role },
    },
  })

  if (error) {
    log.error('register', 'Supabase signUp error', {
      message: error.message,
      code: (error as { code?: string }).code,
      status: (error as { status?: number }).status,
    })
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'An account with this email already exists. Try signing in instead.' }
    }
    if (error.message.toLowerCase().includes('database')) {
      return { error: 'Something went wrong creating your account. Please try again.' }
    }
    return { error: error.message }
  }

  log.info('register', 'account created', { email: parsed.data.email, role: parsed.data.role })
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  log.info('logout', 'signing out')
  await supabase.auth.signOut()
  redirect('/login')
}
