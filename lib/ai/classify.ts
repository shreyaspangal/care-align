'server-only'

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { AI_MODELS } from './models'
import { ClassificationSchema, type Classification } from './schemas'

const DOCUMENT_TYPES = `- prescription: medication instructions from a doctor
- lab_report: results from blood, urine, imaging, or other diagnostic tests
- discharge_summary: summary given when patient leaves hospital or completes care
- bill: charges for medical services, room, procedures, or medication
- observation_note: nursing or doctor notes about patient condition during stay
- other: anything that does not fit the above`

function buildPrompt(hints?: { type?: string; hospital?: string }): string {
  let prompt = `You are classifying a medical document for a patient's health record.

Classify this document and return structured JSON only.

Document types:
${DOCUMENT_TYPES}

Rules:
- suggested_name: exact name as it appears on the document, or a clear best guess
- suggested_purpose: plain language description, e.g. "Pre-operation blood work"
- document_date: ISO date string (YYYY-MM-DD) if found on the document, null if not found
- source_hospital and source_department: null if not found
- If the document is not in English, classify as type "other"
- If the document is unreadable, still return your best guess and set all nullable fields to null`

  if (hints?.type || hints?.hospital) {
    prompt += '\n\nThe coordinator provided these advisory hints — use them if the document confirms them, ignore them if the document contradicts them:'
    if (hints.type) prompt += `\n- Suggested type: ${hints.type}`
    if (hints.hospital) prompt += `\n- Suggested hospital: ${hints.hospital}`
  }

  return prompt
}

export async function classifyDocument(
  fileBuffer: Buffer,
  mimeType: string,
  hints?: { type?: string; hospital?: string }
): Promise<Classification> {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.classify),
    schema: ClassificationSchema,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(hints) },
          { type: 'file', data: fileBuffer, mediaType: mimeType },
        ],
      },
    ],
  })
  return object
}
