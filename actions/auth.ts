'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LoginSchema, RegisterSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('actions:auth')

export type AuthFormState = {
  error?: string
  message?: string
} | undefined

export async function register(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = RegisterSchema.safeParse({
    familyName: formData.get('familyName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error || !data.user) {
    log.error('register', 'signUp failed', { error: error?.message })
    return { error: error?.message ?? 'Could not create the account' }
  }

  // The families row cannot pass RLS before it exists (current_family_id()
  // resolves through it), so the initial insert uses the service client.
  const service = createServiceClient()
  const { error: familyError } = await service.from('families').insert({
    owner_user_id: data.user.id,
    name: parsed.data.familyName,
  })
  if (familyError) {
    log.error('register', 'families insert failed', { error: familyError.message })
    return { error: 'Account created but family setup failed — try logging in' }
  }

  if (!data.session) {
    // Email confirmation is enabled on the project — no session until confirmed.
    return { message: 'Check your email to confirm your account, then log in.' }
  }

  redirect('/profiles')
}

export async function login(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: 'Wrong email or password' }
  }

  redirect('/profiles')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
