import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CreatePatientForm } from '@/components/features/CreatePatientForm'
import { ArrowLeft } from 'lucide-react'

export default async function NewPatientPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to patients
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Add a patient</h1>
        <p className="text-sm text-muted-foreground">
          Enter the patient&apos;s details to start managing their care documents.
        </p>
      </div>

      <CreatePatientForm />
    </div>
  )
}
