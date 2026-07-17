'use client'

import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'

type LogoutButtonProps = {
  action: () => Promise<void>
}

export function LogoutButton({ action }: LogoutButtonProps) {
  return (
    <form
      action={async () => {
        posthog.reset()
        await action()
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Log out
      </Button>
    </form>
  )
}
