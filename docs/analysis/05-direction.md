# 05 — Direction: The Family Health Timeline

> Output of the Phase 5 conversation (2026-07-14). Supersedes SPEC.md's product definition. The decisions below were made explicitly by the founder in conversation — not inferred.
>
> Numbering note: `04-problem-research.md` was folded into `03-niche-discovery.md` when the session pivoted; there is no 04.

---

## 1. The wedge (founder-verified, research-validated)

**The moment:** a doctor asks "any history? what medications? when was that last test?" — and the answer exists, but it's scattered across folders, files, WhatsApp, and memory.

**The product:** the app that makes you the family member who *always has the answer*. A per-person **timeline of health history** built from every document shared in — organized, synthesized, and retrievable in seconds — plus appointment management so nothing is forgotten.

**Provenance:** this is the founder's lived pain (stated directly: gathering files when the doctor asked for history; waiting for the doctor to explain terms; being lost in piles of files). It is independently validated by Razorpay Fix My Itch's top-10 problem ("caring for aging parents for sole earners across cities — fragmented & stressful") and by the research in `03-niche-discovery.md`.

**The critical reframe vs. the graveyard risk:** ABHA proves storage-first PHR products die (90cr accounts, ~11.7% household acceptance). This product is **retrieval-first, not storage-first** — the hero interaction is the *visit moment* (one-tap brief in front of a doctor) and the *appointment loop* (recurring reason to return), with the timeline as the substrate underneath.

## 2. Locked decisions

| # | Decision | Detail |
|---|----------|--------|
| D1 | **AI boundary: explain, never advise** | The AI may define terms and state factually what a document says ("HbA1c measures average blood sugar; this report records 8.1%"). It never interprets severity, suggests actions, compares against norms, or recommends anything. Synthesis = organizing facts, not judging them. This is a hard rule at CLAUDE.md level in the rebuild. |
| D2 | **Family model: Netflix-style account + profiles** | One account = one family; one shared login. Family members are **profiles** (name, photo, timeline) — not users, no per-member logins, no invites, no grants, no consent machinery. Profiles are visible to everyone in the account by default; any profile can optionally be locked behind a PIN/password. Accepted trade-off (chosen with open eyes): shared password ⇒ shared visibility; equivalent to the household file drawer (DPDP "pre-existing exposure"); profile locks are the escape valve. |
| D3 | **No coordinator/patient role split** | The founder called the old split "redundant." Everyone in the account manages any unlocked profile equally, including their own. This finally implements the previously undocumented "profile-based architecture" intent. |
| D4 | **Greenfield rebuild** | The CareAlign codebase is not the substrate. `docs/analysis/01` and `02` are its record; salvage list in §5. |
| D5 | **V1 scope confirmed** (see §3) | Founder confirmed the five-piece slice verbatim. |

## 3. V1 — confirmed scope

1. **Family account + profiles** — with optional per-profile PIN lock.
2. **Document capture** — photo/PDF upload into a member's timeline.
3. **AI organization** — extract date, document type, doctor, facility; define terms; state factually what the document says (within D1).
4. **Retrieval** — search across a profile + one-tap **"visit brief"**: a single screen of that member's conditions, medications, and recent reports, showable to a doctor.
5. **Appointments** — per profile, with reminders.

**Explicitly out of V1:** hospital/insurer discovery (V2, founder-stated), sharing outside the account, insurance claims, regional languages, anything advisory, notifications beyond appointment reminders.

**V2 direction (founder-stated, not yet designed):** discovery of hospitals/insurance providers near a given location — acknowledged as individually solved elsewhere; the bet is phased unification into one platform.

## 4. Why this and not the hospitalisation wedges

`03-niche-discovery.md` scored three episode-centric wedges (W1 command centre / W2 discharge decoder / W3 claim companion). The founder's lived pain sits *before and after* the hospital episode — at the ordinary doctor visit — and the founder explicitly rejected the advisory/task-generating posture those wedges lean on (D1). W1–W3 remain documented as expansion candidates; a hospitalisation is, in this product's terms, simply a burst of documents entering a timeline. Nothing in V1 forecloses them.

## 5. Salvage list from CareAlign (design assets, not code)

- **AI pipeline patterns:** `generateText + Output.object`, model-tier map, mediaType handling, NoOutputGeneratedError, "silence is valid," nullable extraction fields ("Date unknown", never fabricate).
- **Two-layer Supabase discipline:** GRANT + RLS both required; silent 0-row failure pattern; service-role bootstrap pattern.
- **Enforcement stack:** lint:arch approach (tsc + custom ESLint AST rules + story checks), pre-commit hooks, DAL boundary, server-action injection pattern, domain-types-in-one-file rule.
- **Docs discipline:** ANTI_PATTERNS.md, CONTENT_LOG.md practice, the CLAUDE.md "where rules belong" test.
- **Deliberately NOT salvaged:** patient_access/roles/invite/PIN/provenance machinery (D2/D3 make it unnecessary — the WhatsApp+PIN invite ritual is parked as a design memory for any future cross-account sharing), episode status machine, coordinator/patient route branching, document_actions → pending_tasks generation (advisory; violates D1).

## 6. Architecture references adopted

- **Frontend:** GreatFrontEnd playbook extractions — News Feed patterns for the timeline (normalized store, cursor pagination, optimistic writes with idempotency keys; virtualization/outbox deferred as scale-inappropriate), Autocomplete patterns for retrieval (300ms debounce, query-keyed responses, normalized cache, ARIA combobox). Pending: Photo Sharing case study (premium; founder to extract to `docs/research/extracts/`) for the capture pipeline.
- **Design-doc structure:** RADIO (Requirements → Architecture → Data model → Interface → Optimizations).
- **Database/backend:** Supabase production checklist + RLS performance guides; PostgreSQL "Don't Do This." Hyperscale playbooks deliberately skipped (per prior Notion-infra conclusion: premature).
- **AI:** applied-llms.org series + Anthropic docs/cookbook + AI SDK v6 docs.

## 7. Open items (next: the build plan)

1. Product name (CareAlign belongs to the old model; repo is "Kaagaz" — decide before scaffolding).
2. Greenfield system-design doc (RADIO): schema, capture pipeline, retrieval architecture, visit-brief spec.
3. Build plan with phase gates (the CareAlign phase-exit discipline carries over).
4. Photo Sharing extraction → capture-pipeline design.
5. Whether the rebuild lives in this repo (fresh root) or a new repo.
