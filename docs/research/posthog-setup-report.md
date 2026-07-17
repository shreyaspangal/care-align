# PostHog post-wizard report

PostHog has been integrated into this Next.js App Router application with browser initialization, server-side event delivery, error tracking, authenticated-user identification, and a first-party `/ingest` proxy. The browser SDK initializes in `instrumentation-client.ts`; server actions use `posthog-node` with immediate flushing before redirects. Authentication identifies users by their Supabase user ID and stores the email only as a person property. Event properties intentionally contain no patient, profile-name, PIN, or other sensitive health information.

| Event name | Description | File |
| --- | --- | --- |
| `account_registered` | A new family account was created successfully. | `actions/auth.ts` |
| `user_logged_in` | An authenticated user logged in successfully. | `actions/auth.ts` |
| `profile_created` | A family member profile was created. | `actions/profiles.ts` |
| `profile_updated` | A family member profile was updated. | `actions/profiles.ts` |
| `profile_unlocked` | A family member profile was unlocked successfully. | `actions/profiles.ts` |
| `profile_selected` | A family member profile was selected from the profile picker. | `components/features/ProfileGrid.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://eu.posthog.com/project/215321/dashboard/828932)
- [Account registration to profile creation (wizard)](https://eu.posthog.com/project/215321/insights/bUhR7i9Y)
- [Successful logins (wizard)](https://eu.posthog.com/project/215321/insights/etwJbGIQ)
- [Family profiles created (wizard)](https://eu.posthog.com/project/215321/insights/hPTcnVQq)
- [Profile selections by protection (wizard)](https://eu.posthog.com/project/215321/insights/JGnUuyPJ)
- [Profile unlocks (wizard)](https://eu.posthog.com/project/215321/insights/qjWYsyYn)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add the exact PostHog env var names you added to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
