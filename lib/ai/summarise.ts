'server-only'

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AI_MODELS } from './models'
import { EpisodeSummarySchema, type EpisodeSummary } from './schemas'

type DocumentSummary = {
  plain_language: string
  what_it_means: string
  document_date: string | null
  document_type: string
}

const PROMPT = (
  patientName: string,
  startedAt: string,
  summaries: DocumentSummary[]
) => {
  const docs = summaries
    .map(
      (d, i) =>
        `[Document ${i + 1} — ${d.document_type}${d.document_date ? `, ${d.document_date}` : ''}]\n${d.plain_language}\n${d.what_it_means}`
    )
    .join('\n\n')

  return `You are writing a plain-language health summary for a patient's family.
The patient's name is ${patientName}.
Their hospitalisation started on ${startedAt}.

Below are plain-language summaries of all medical documents from this episode, in chronological order:

${docs}

Write a summary that:
1. Explains why the patient came to hospital (visit_purpose)
2. Describes what has happened in chronological order (timeline_summary — paragraphs separated by \\n\\n)
3. States the patient's current status as a short label (status_label: max 50 chars) and one sentence (status_description: max 200 chars)

Do not include actions or tasks. If nothing significant has changed, reflect stability — do not manufacture urgency.`
}

export async function regenerateEpisodeSummary(
  patientName: string,
  startedAt: string,
  translations: DocumentSummary[]
): Promise<EpisodeSummary> {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.summarise),
    schema: EpisodeSummarySchema,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: PROMPT(patientName, startedAt, translations),
      },
    ],
  })
  return object
}
