import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveEpisode } from '@/lib/dal/episodes'
import { getEpisodeTasks } from '@/lib/dal/tasks'
import { TasksClient } from '@/components/features/TasksClient'
import { resolveTask } from '@/actions/resolve-task'

type Props = {
  params: Promise<{ patientId: string }>
}

export default async function TasksPage({ params }: Props) {
  const { patientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('patient_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .single()

  if (!access || access.role !== 'coordinator') notFound()

  const activeEpisode = await getActiveEpisode(patientId)
  const tasks = activeEpisode ? await getEpisodeTasks(activeEpisode.id) : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <TasksClient
        tasks={tasks}
        defaultShowPostDischarge={
          activeEpisode?.status === 'care_complete' ||
          activeEpisode?.status === 'closed'
        }
        onResolve={resolveTask}
      />
    </div>
  )
}
