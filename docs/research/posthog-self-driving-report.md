# PostHog Self-driving — Setup Report

_Generated 2026-07-17_

## Summary

PostHog Self-driving has been configured for CareAlign. Session Replay, Error Tracking, and Support signal sources are live; the GitHub integration is connected; and a three-scout troop (general, product-analytics, observability-gaps) is running. Findings will start appearing in the Self-driving inbox at https://eu.posthog.com/project/215321/inbox within approximately 30 minutes.

---

## AI Data Processing

**Approved.** Organization-level AI data processing was approved before this run started.

---

## GitHub

**Connected during this run.** The PostHog GitHub App was installed for `shreyaspangal` (integration id: 71655, created 2026-07-17). Self-driving can now research findings against the CareAlign repository and open fix PRs.

---

## Products Enabled

| Product | Status | Notes |
|---|---|---|
| Session Replay | Enabled | Recordings already confirmed in step 2. `posthog.init` has no `disable_session_recording` override — client-side clean. |
| Error Tracking | Enabled | `posthog.init` sets `capture_exceptions: true` — client-side clean. No error issues have arrived yet; the source is armed and will pick them up as they occur. |
| Support (Conversations) | Enabled (inert) | Server-side product is on, but tickets only arrive once an inbound channel (email, inbox, or Slack) is connected in PostHog. See Follow-ups. |

Note: `products-enable` MCP tool was not available in this PostHog deployment. Session Replay and Error Tracking are confirmed live via instrumentation evidence (recordings found, `capture_exceptions: true`). Support was recorded as a follow-up.

---

## Signal Sources

| source_product | source_type | Action | Notes |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | Skipped | ON by default — creating a row would opt out. Scout gate is already active. |
| `error_tracking` | `issue_created` | **Enabled** (id: 019f7013-6775…) | |
| `error_tracking` | `issue_reopened` | **Enabled** (id: 019f7013-6a6f…) | |
| `error_tracking` | `issue_spiking` | **Enabled** (id: 019f7013-6e1c…) | |
| `session_replay` | `session_analysis_cluster` | **Enabled** (id: 019f7013-74bf…) | Server injected default sample rate (10%). |
| `conversations` | `ticket` | **Enabled** (id: 019f7013-782d…) | Dormant until an inbound channel is connected. |

---

## Connected Tools

| Tool | Status |
|---|---|
| GitHub Issues | Not used (not selected by user) |
| Linear | Not used (not selected by user) |
| Zendesk | Not used (not selected by user) |
| pganalyze | Not used (not selected by user) |
| Jira | Not used (not selected by user) |

---

## Scout Troop

26 scouts materialized via `scout-config-sync`.

### Enabled (3)

| Scout | Reason |
|---|---|
| `signals-scout-general` | Always enabled — cross-product correlations and uncovered surfaces. Was already on after sync. |
| `signals-scout-product-analytics` | CareAlign's most active surface: 6 instrumented events (auth + profile CRUD) and saved funnel/retention insights. Watches saved flows for conversion/retention regression. |
| `signals-scout-observability-gaps` | Phase 1 is complete with minimal coverage; Phases 2–5 will ship new events rapidly. This scout flags event volumes with no insight or alert coverage so new surfaces get instrumented promptly. |

### Disabled (23)

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | Covered by the native error_tracking source (steps 3b + 4). Native source is the correct path; duplicate scout adds noise. |
| `signals-scout-session-replay` | Covered by the native session_replay source (steps 3b + 4). Same reasoning. |
| `signals-scout-ai-observability` | No `$ai_*` events instrumented yet (Phase 2 pending). **Re-enable when the AI document pipeline ships.** |
| `signals-scout-web-analytics` | No web analytics / UTM tracking set up. Re-enable if web traffic analysis is added. |
| `signals-scout-feature-flags` | No feature flags in use. Re-enable when flags are introduced. |
| `signals-scout-surveys` | No surveys configured. Re-enable if surveys are added. |
| `signals-scout-revenue-analytics` | No payment SDK or revenue events. Re-enable if billing is added. |
| `signals-scout-experiments` | No A/B experiments configured. Re-enable when experiments launch. |
| `signals-scout-logs` | PostHog logs product not in use. Re-enable if logs are wired. |
| `signals-scout-csp-violations` | No CSP reporting configured. Re-enable if CSP is set up. |
| `signals-scout-customer-analytics` | No group/accounts analytics (B2B). Not applicable to CareAlign's B2C family model. |
| `signals-scout-data-pipelines` | No CDP destinations or hog flows configured. |
| `signals-scout-data-warehouse` | No external data warehouse sources connected. |
| `signals-scout-apm` | No distributed tracing / OpenTelemetry spans. |
| `signals-scout-mcp-tool-calls` | No `$mcp_tool_call` telemetry. |
| `signals-scout-replay-vision` | No Replay Vision scanners configured. |
| `signals-scout-anomaly-detection` | No dashboards with enough history yet for seasonality-matched baselines. Re-enable once the project has weeks of data. |
| `signals-scout-health-checks` | Deferred to avoid noise on a fresh setup. Re-enable after first month. |
| `signals-scout-ingestion-warnings` | Not yet warranted at this event volume. |
| `signals-scout-insight-alerts` | No configured insight alerts. |
| `signals-scout-inbox-validation` | No shipped fixes to validate yet (fresh setup). |
| `signals-scout-skills-store` | Not relevant to product health monitoring. |
| `signals-scout-web-vitals` | No `$web_vitals` events captured yet. Re-enable when Core Web Vitals instrumentation is added. |

---

## Custom Scouts

**None created.** Gap analysis found no surfaces that passed all three filters (watchable, uncovered, discriminator-ready) for Phase 1:

| Surface considered | Filter that ruled it out |
|---|---|
| Registration → profile creation funnel | Already covered by `signals-scout-product-analytics` (saved funnel insight exists) |
| Profile PIN unlock health | No failure/attempt event instrumented — can't build a discriminator |
| Absolute acquisition volume health | Covered by `signals-scout-general` (cross-product correlations) |
| AI document organize pipeline | Phase 2 pending — zero `$ai_*` events exist yet |
| Auth cliff detection | Covered by `signals-scout-general` |

**Highest-priority future scout:** once Phase 2's document capture and AI organization pipeline ships, enable `signals-scout-ai-observability` and consider a custom scout watching `document_capture_started` → `document_organized` → `needs_review` funnel health. That pipeline is CareAlign's core value-delivery path and worth dedicated monitoring.

**Noise escape hatch:** if any scout turns out too noisy, set `emit: false` on its config in PostHog Settings → Self-driving to switch it to dry-run mode.

---

## Follow-ups

- [ ] **Connect a Support inbound channel** — email, inbox, or Slack — in PostHog so support tickets reach the Self-driving inbox. Link: https://eu.posthog.com/project/215321/settings/environment-integrations
- [ ] **Verify Session Replay and Error Tracking are toggled ON in project settings** — the `products-enable` tool was unavailable during this run, so the server-side product toggles were not confirmed flipped. Both have client-side instrumentation in place; confirm the project-level toggles at https://eu.posthog.com/project/215321/settings
- [ ] **Enable `signals-scout-ai-observability`** when Phase 2's AI document pipeline ships and `$ai_*` events are instrumented. Both `@ai-sdk/anthropic` and `@ai-sdk/openai` are in the project's dependencies — this will become the most important scout for CareAlign once that pipeline is live.
- [ ] **Enable `signals-scout-anomaly-detection`** after a few weeks of data so the seasonality-matched baselines have enough history to be meaningful.
- [ ] **Source-map upload** — wire `posthog-cli sourcemap` into CI so production stack traces de-minify in error tracking reports (noted in the base integration report).
- [ ] **Returning-visitor identify** — confirm that returning authenticated sessions also call `identify`, not just fresh logins (noted in the base integration report).

---

## What Happens Next

The scout coordinator picks up fresh configs within ~30 minutes. Scouts then run on their default 24-hour interval. Error tracking and session replay findings arrive via their native sources as events occur. The inbox at https://eu.posthog.com/project/215321/inbox is where all findings land — immediately-actionable ones can go straight to a coding task.
