import { setupServer } from 'msw/node'
import { claudeHandlers } from './handlers/claude'

// Node-side MSW server shared by every fast test. Per-test overrides are added
// with `server.use(...)` and cleared by `resetHandlers()` in setup.ts.
export const server = setupServer(...claudeHandlers)
