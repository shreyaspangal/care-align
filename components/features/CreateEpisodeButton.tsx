'use client'

import { useState, useTransition } from 'react'
import { Loader2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createEpisode } from '@/actions/create-episode'

export function CreateEpisodeButton({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await createEpisode(patientId)
      if ('error' in result) setError(result.error)
    })
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={isPending} size="sm">
        {isPending ? (
          <>
            <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
            Creating episode…
          </>
        ) : (
          <>
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Start new episode
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
