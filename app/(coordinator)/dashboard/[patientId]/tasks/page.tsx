import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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

  const { data: patient } = await supabase
    .from('patients')
    .select('id, name')
    .eq('id', patientId)
    .single()

  if (!patient) notFound()

  const activeEpisode = await getActiveEpisode(patientId)

  const tasks = activeEpisode ? await getEpisodeTasks(activeEpisode.id) : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-3">
        <Link
          href={`/dashboard/${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to episode
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Pending Tasks</h1>
          <p className="text-sm text-muted-foreground">{patient.name}</p>
        </div>
      </div>

      <TasksClient
        tasks={tasks}
        onResolve={resolveTask}
      />
    </div>
  )
}
