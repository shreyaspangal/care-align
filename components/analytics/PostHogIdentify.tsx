'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

export function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        posthog.identify(user.id, { email: user.email })
      }
    })
  }, [])

  return null
}
