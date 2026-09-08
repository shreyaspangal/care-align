# Playbook: Free-tier keepalive + monitoring (portable across projects)

> This doc is written to be **copied into any other project**, not just read here. Everything under "Generic pattern" has no CareAlign-specific names in it. The "Worked example" section at the bottom shows the concrete implementation in this repo, for reference — it's the instance, not the pattern.

## When you need this

Any time a project depends on a **free-tier third-party service that auto-deletes or suspends idle resources** (Upstash Redis: 14 days idle → deleted; some Supabase free-tier projects pause on inactivity; similar policies exist across most free-tier infra providers) and that resource is only touched by low-frequency background work (a rate limiter, a cache, a queue) rather than constant user traffic that would naturally keep it alive.

The symptom, if you don't have this: the dependency silently stops existing, and every call to it starts throwing connection-level errors (`fetch failed`, DNS failure, connection refused) that look exactly like a code bug. See "Mistakes we made" below — this cost a full debugging session before the actual cause (a deleted database, not broken code) was found.

## The pattern, end to end

Four pieces, all required — skipping the last two means the first two can silently break with nobody finding out:

1. **A scheduled ping** (Vercel Cron, or equivalent) that touches the resource on a schedule safely inside its idle-deletion window.
2. **A route that does the actual keepalive work**, gated by a shared secret so randoms on the internet can't hit it.
3. **A middleware/proxy exclusion** for that route — see "Mistakes we made" #1, this is the one that's easy to forget and silent when forgotten.
4. **A dead-man's-switch monitor** so a broken cron raises a real alert instead of only being discoverable by someone happening to check a dashboard.

### 1. The route

```ts
// app/api/cron/keepalive/route.ts (path is your choice, just match vercel.json)
import { NextResponse } from 'next/server'

async function pingHealthcheck(pingUrl: string | undefined, suffix: '' | '/fail') {
  if (!pingUrl) return
  try {
    await fetch(`${pingUrl}${suffix}`)
  } catch {
    // Monitoring is best-effort — a monitor outage must never fail the job itself.
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ... the actual keepalive work: a Redis SET, a trivial DB query, etc.
    await pingHealthcheck(process.env.HEALTHCHECKS_PING_URL, '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    await pingHealthcheck(process.env.HEALTHCHECKS_PING_URL, '/fail')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
```

Key properties, all deliberate:
- `CRON_SECRET` is a Vercel-native convention — if you set an env var literally named `CRON_SECRET`, Vercel automatically sends it as `Authorization: Bearer $CRON_SECRET` on every cron-triggered request. No custom header wiring needed.
- The healthchecks ping is **best-effort and never throws** — if the monitor itself is down, that must not fail the keepalive job it's watching.
- `/fail` is pinged **immediately** on a real failure, rather than relying on the monitor's "missed schedule" timeout — you find out at the moment of failure, not up to a full grace period later.
- The env var is genuinely optional (`if (!pingUrl) return`) — the keepalive still works with no monitoring wired up, useful when bootstrapping before the healthchecks.io check exists yet.

### 2. `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/keepalive",
      "schedule": "0 0 * * 0,3"
    }
  ]
}
```

Use a **day-of-week schedule** (`0,3` = Sunday and Wednesday), not `*/N` on the day-of-month field. `*/2` on day-of-month steps from day 1 (1, 3, 5, ...) and drifts unpredictably across month boundaries — you can get a 1-day gap at some month ends. A day-of-week schedule gives an exact, easy-to-reason-about worst-case gap (Sun→Wed→Sun is a 4-day max gap here) with no calendar edge cases.

Pick a frequency comfortably inside the provider's idle-deletion window with margin for a missed run — a 4-day worst-case gap against a 14-day deletion window is generous; don't cut it close.

### 3. The middleware/proxy exclusion — **the step that's easy to forget**

If the project has any auth middleware/proxy that redirects unauthenticated requests (to a login page, typically), it will intercept the cron's request **before your route's own secret check ever runs** — Vercel's cron scheduler sends no session cookie, so it looks exactly like a logged-out visitor. The result is a silent redirect (307) with the route's actual logic never executing, and no error anywhere to notice.

Find wherever that middleware/proxy's route matcher excludes things (static assets, a webhook endpoint, etc.) and add the cron path to the same list:

```ts
// Next.js example (proxy.ts / middleware.ts config)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Test this specifically** — don't assume it's fine because the route looks correct in isolation. Curl the route locally/against a preview deploy with no cookies at all (a plain `curl`, not a browser session) and confirm you get your route's own 401/200, not a 307 to a login page.

### 4. The dead-man's-switch monitor (healthchecks.io, free tier)

Vercel's own Alerts product (custom threshold/anomaly rules) requires a **Pro** team plan. If the project is on Hobby, that's not available — check `vercel alerts rules add` yourself rather than assuming; it fails with a generic-sounding `forbidden` error that reads like a permissions bug, not a plan-gate (see "Mistakes we made" #3).

healthchecks.io's free tier does the same job independent of Vercel's plan tier:

1. Sign up free at healthchecks.io, create a check.
2. Schedule mode: **Cron Expression**, matching your `vercel.json` schedule exactly, timezone UTC.
3. **Grace Time**: give it real margin (2+ hours) — Vercel's Hobby-plan cron can fire up to ~1 hour later than scheduled; a tight grace period causes false alarms.
4. Copy the **Ping URL** (`https://hc-ping.com/<uuid>`) into `HEALTHCHECKS_PING_URL` as an env var (Production only — it doesn't need to exist in dev/preview, the route treats it as optional).
5. The route pings the plain URL on success, `<url>/fail` on failure (see the route code above).

This isn't a secret in the access-control sense (it's a write-only ping endpoint — someone else pinging it can only make your monitor think things are fine when they aren't, they can't read or change anything), but keep it as an env var anyway for consistency with how the rest of the project handles config.

## Verifying it actually works, without waiting for the real schedule

In order, cheapest/safest first:

1. **Unit tests, fully mocked** (the keepalive work, the auth check, and `fetch` all mocked) — zero real network calls, verifies the logic (auth-reject, success path, failure path, monitoring-optional path) in isolation.
2. **Local dev server against the real backing service** (real Redis/DB creds, a throwaway local `CRON_SECRET`) — curl with no auth header (expect 401), wrong secret (expect 401), correct secret (expect 200 and confirm only the intended key/row was touched — nothing else should be affected). This is also where the middleware-exclusion bug above actually gets caught, since local dev runs the same middleware.
3. **Deploy, then `vercel crons run /api/cron/keepalive`** — the official Vercel CLI command for exactly this, triggers the deployed cron immediately with the correct auto-injected auth header, so you don't have to wait for the real schedule to confirm production wiring. Check `vercel crons ls` first to confirm the schedule registered as expected.
4. **Check the healthchecks.io dashboard/email** for that check flipping to "up" with a matching timestamp — this is the one thing no CLI or log can confirm for you; it requires actually looking at the monitor's own record.

## Mistakes we made building this (so the next pass skips them)

1. **The middleware/proxy exclusion is the one that bites hardest, because it's completely silent.** The route looked correct, unit tests passed, and it still would have never worked in production — every cron-triggered request got redirected to `/login` before the route ever ran, with no error anywhere. Caught only because step 2 above (local curl test) was actually run before deploying, instead of trusting code review alone.
2. **Free-tier idle-deletion looks exactly like a code bug.** When the underlying resource silently stops existing, the resulting `fetch failed` error's first suspect is always "did I misconfigure credentials / break networking," not "does this resource still exist." Check whether the resource itself still exists (provider's own dashboard) before debugging the calling code, whenever a free-tier dependency starts failing with a connection-level error rather than an auth/validation one.
3. **Don't assume the platform's own alerting is available or adequate — check the actual plan gate.** `vercel alerts rules add` failed with `"reason": "forbidden"`, which reads like a permissions bug. The actual cause was a plan tier gate (Alerts needs Pro; the team was on Hobby) — confirmed by checking the team's plan directly, not by guessing from the error message.
4. **`*/2` on the day-of-month cron field isn't the same as "every 2 days."** It steps from day 1 (1, 3, 5, ...) and can produce a 1-day gap across month boundaries. A day-of-week schedule (e.g. `0,3` for Sun/Wed) is both more precise and easier to reason about.
5. **A fail-open fix for a *different* bug is what exposed this one.** The rate limiter's fail-open-on-infra-failure fix didn't cause the Redis deletion — it made a pre-existing, already-silent problem observable for the first time (previously, rate limiting was hard-disabled, so nothing ever called the dead Redis instance). When a "fix" surfaces a new-looking failure the very next day, check whether it's a regression or whether it just turned the lights on in a room that was already broken.
6. **Modifying production secrets via CLI got blocked by a sandboxed-agent permission classifier** (`vercel env rm`/`add` treated as a sensitive action needing explicit human approval) — expected and correct behavior for an agent operating with elevated trust; the fix was simply to ask and get explicit permission, not to find a workaround.

## Worked example in this repo (CareAlign)

- Route: `app/api/cron/keepalive/route.ts`
- Schedule: `vercel.json`
- Proxy exclusion: `proxy.ts`'s `config.matcher`
- Redis client reuse (no second client instantiated): `lib/ratelimit.ts`'s exported `redisClient`
- Tests: `__tests__/unit/cron-keepalive.test.ts`
- Decision record (why, options considered, revisit triggers): `docs/DECISIONS.md` D-015
- The original incident this all traces back to: `docs/ANTI_PATTERNS.md` #14
