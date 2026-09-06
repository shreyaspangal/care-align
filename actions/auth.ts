'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LoginSchema, RegisterSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { createPostHogClient } from '@/lib/posthog-server'

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
    if (error && isAuthRetryableFetchError(error)) {
      return { error: 'Could not reach the server — check your connection and try again' }
    }
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

  // after(): analytics delivery must not delay the redirect (EU round-trip).
  const userId = data.user.id
  const emailConfirmationRequired = !data.session
  after(async () => {
    const posthog = createPostHogClient()
    posthog.identify({
      distinctId: userId,
      properties: { email: parsed.data.email },
    })
    posthog.capture({
      distinctId: userId,
      event: 'account_registered',
      properties: { email_confirmation_required: emailConfirmationRequired },
    })
    await posthog.shutdown()
  })

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
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) {
    if (error && isAuthRetryableFetchError(error)) {
      log.error('login', 'signIn network failure', { error: error.message })
      return { error: 'Could not reach the server — check your connection and try again' }
    }
    return { error: 'Wrong email or password' }
  }

  const userId = data.user.id
  after(async () => {
    const posthog = createPostHogClient()
    posthog.identify({
      distinctId: userId,
      properties: { email: parsed.data.email },
    })
    posthog.capture({ distinctId: userId, event: 'user_logged_in' })
    await posthog.shutdown()
  })

  redirect('/profiles')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
