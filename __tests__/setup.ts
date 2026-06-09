import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// MSW intercepts outbound HTTP (the Claude API) during the fast suite so no
// test ever hits a real model. `onUnhandledRequest: 'error'` makes an un-mocked
// request fail the test loudly rather than silently reaching the network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
