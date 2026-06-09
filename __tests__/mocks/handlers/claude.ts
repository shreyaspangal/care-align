import { http, HttpResponse } from 'msw'

// Default Claude handler: returns a valid classification response so any code
// path that calls the model in the fast suite gets a well-formed answer.
// Tests that need a different shape (errors, adversarial output, empty actions)
// override this per-test with `server.use(...)`.
//
// NOTE: the response envelope below is a placeholder for the wiring check in
// Phase 1. The exact Anthropic Messages API shape the Vercel AI SDK expects is
// verified against the installed @ai-sdk/anthropic package in Phase 6, where
// the real classify/translate functions are built.
export const claudeHandlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            type: 'prescription',
            suggested_name: 'Test Prescription',
            suggested_purpose: 'Post-operation medication',
            document_date: '2024-01-15',
            source_hospital: 'Test Hospital',
            source_department: 'General Medicine',
          }),
        },
      ],
    })
  }),
]
