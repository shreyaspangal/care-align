// Retries only transient failures (network blips, 5xx) — an error explicitly
// thrown as NonRetryableError (invalid file type, "not authenticated", a
// validation message) is a real outcome, not a transport hiccup, and
// retrying it would just repeat the same failure three times before
// surfacing it to the user.
export class NonRetryableError extends Error {}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { retries = 2, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      if (err instanceof NonRetryableError || attempt >= retries) throw err
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt))
    }
  }
}
