'server-only'

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AI_MODELS } from './models'
import { TranslationSchema, type Translation } from './schemas'

const PROMPT = (documentType: string, patientName: string) => `You are translating a medical document for a patient's family member.
The family member is not a medical professional.
The patient's name is ${patientName}.
This document is a ${documentType}.

Your job:
1. Explain what this document says in plain language a non-medical person can understand (plain_language: min 2 sentences, max 8)
2. Explain what this specifically means for ${patientName} (what_it_means: 1-3 sentences)
3. List any actions that need to be taken because of this document (actions: empty array if none)

Rules:
- No medical jargon without explanation
- No assumptions beyond what the document states
- No medical advice or treatment recommendations
- If something is unclear, say it is unclear — do not guess
- actions: [] is a valid and correct response when no action is required
- For each action, assign category and phase_appears based on what the document actually requires`

export async function translateDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string,
  patientName: string
): Promise<Translation> {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.translate),
    schema: TranslationSchema,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT(documentType, patientName) },
          { type: 'file', data: fileBuffer, mediaType: mimeType },
        ],
      },
    ],
  })
  return object
}
