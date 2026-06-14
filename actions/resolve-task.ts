'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ResolveTaskSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('resolveTask')

export type ResolveTaskResult = { ok: true } | { ok: false; error: string }

export async function resolveTask(taskId: string): Promise<ResolveTaskResult> {
  const parsed = ResolveTaskSchema.safeParse({ taskId })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Fetch task to verify it exists and belongs to an episode this coordinator can access
  const { data: task } = await supabase
    .from('pending_tasks')
    .select('id, status, episode_id, episodes(patient_id)')
    .eq('id', parsed.data.taskId)
    .single()

  if (!task) {
    log.warn('resolveTask', 'task not found', { taskId, userId: user.id })
    return { ok: false, error: 'Task not found.' }
  }

  if (task.status === 'resolved') {
    return { ok: false, error: 'Task is already resolved.' }
  }

  const { error } = await supabase
    .from('pending_tasks')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', parsed.data.taskId)

  if (error) {
    log.error('resolveTask', 'update failed', { taskId, error: error.message })
    return { ok: false, error: 'Failed to resolve task. Please try again.' }
  }

  log.info('resolveTask', 'task resolved', { taskId })

  const patientId = (task.episodes as { patient_id?: string } | null)?.patient_id
  if (patientId) revalidatePath(`/dashboard/${patientId}`)
  revalidatePath(`/dashboard/${patientId}/tasks`)

  return { ok: true }
}
