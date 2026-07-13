# Privacy, Consent & Trust Research — Family Vault / Unified Interface Decision

**Date:** 2026-07-02
**Why this exists:** Before deciding whether to collapse CareAlign's current coordinator/patient split interfaces (`app/(coordinator)/`, `app/(patient)/`) into one unified "manage all your family members' records" surface (see `docs/ONBOARDING_RESEARCH.md`), the user asked to validate the privacy/trust concerns first — not skip them. This researches how existing products and Indian law handle one person managing another person's health data.

**This is research, not legal advice.** The DPDP Act section below summarizes secondary sources (law firm analyses, a peer-reviewed article, compliance vendors) interpreting the statute — not a lawyer's clause-by-clause read. Anything load-bearing for compliance needs actual counsel before shipping. Confidence level is noted per claim; several items are explicitly flagged as unverified.

---

## The one finding that matters most

**India's DPDP Act 2023 has no legal pathway for "adult manages another competent adult's health data."** It provides for two narrow delegation cases — children under 18, and persons with disability under a lawful guardian (Section 9, "verifiable consent" from the guardian) — plus a "Right to Nominate" (Section 14) that only activates on the record-subject's **death or incapacity**, and must be set up by the subject themselves in advance. There is no equivalent for the everyday case CareAlign is actually built around: an adult child managing a competent, hospitalized-but-conscious parent's records, or a spouse managing a spouse's records. Multiple sources (including a peer-reviewed article) flag this as an unaddressed gap in the Act, not something CareAlign is missing — the law itself hasn't caught up to this use case. (Confidence: medium-high — inferred from absence across many sources, not from a line-by-line statute read.)

**This is not a new risk introduced by the family-vault idea — it's already present in CareAlign's current coordinator/patient model.** A coordinator today already manages a patient's records without a DPDP-anchored consent mechanism specific to that relationship. Unifying into one interface doesn't create this exposure; it would scale it across more relationships and more people's data at once, which raises the importance of getting mitigations right, but doesn't change the underlying legal picture.

One piece of good news: DPDP does **not** treat health data as a special/heightened category the way GDPR does (Article 9 has no DPDP equivalent — this was dropped from the 2019 draft bill). So there's no extra statutory bar specific to health data beyond ordinary Section 6 consent rules. But Section 6(4) gives the actual data subject (the patient, not the account manager) an **unconditional right to withdraw consent at any time**, "as easy as giving it was" — this is the one clear, affirmative obligation that should anchor product design regardless of which interface model is chosen: **the patient must always be able to see who has access to their data and revoke it themselves, independent of who set the record up.**

## Documented real-world risk: this isn't hypothetical

A peer-reviewed US study found **49% of adults have served as a "digital proxy"** for someone else, and about a third of those used *informal* access (shared passwords) rather than a sanctioned mechanism — the authors explicitly link this pattern to elevated elder-abuse risk. Separately, family-perpetrated elder financial abuse has a documented ~5.2% one-year prevalence in the National Elder Mistreatment Study. This is a live, recognized concern in elder-law practice, not a fringe worry — worth taking seriously precisely because CareAlign's target user (a family coordinating a relative's hospitalization) is the exact demographic this research is about.

The clearest **anti-pattern** found: CareZone's model was all-or-nothing full-profile access, granted purely on the account-creator's self-attestation that they had authority to act for the other person — with no independent verification or notification to the person being managed. This is the pattern to explicitly avoid.

## What good mitigation looks like (from MyChart and DPDP itself)

- **Bilateral revocation.** In MyChart, either the patient/subject *or* the proxy can sever the access grant from their own side — it's not one-directional. CareAlign's `patient_access` model can mirror this: revocation shouldn't require the coordinator's cooperation.
- **Visible, current access list.** Patients can see who currently holds proxy access (a "Sharing Hub"), even though a full view-by-view audit log appears not to be self-service anywhere researched. A visible "who has access to this record" list is the achievable, high-value piece — a full audit trail is a nice-to-have, not the load-bearing mitigation.
- **No institutional gatekeeper to lean on.** MyChart's heavy identity verification (photo ID, sometimes in-person, sometimes a court order for guardianship) is only possible because a hospital sits in the approval loop. CareAlign is self-service by design — patients are often incapacitated at signup time, which is the whole premise of the coordinator role — so it cannot replicate MyChart's verification bar. The realistic mitigation is product-level, not verification-level: make the grant visible to the patient the moment they're able to see it, let them revoke unilaterally, and avoid silently expanding a coordinator's access without a visible trail of what was granted and when.
- **DPDP's Section 7(c)** provides a lawful basis for processing without consent in a genuine medical emergency — this is the closest thing to a "break glass" legal footing, though no ABDM technical break-glass mechanism was confirmed to exist. Not something to build toward now; noted for completeness since break-glass patterns came up in every other source (Yale HIPAA guidance, Australia's My Health Record).

## Open question this doesn't resolve

One Medical's separate-login-per-family-member model — the strictest, most consent-protective pattern found — has no documented rationale anywhere (not from One Medical, not from any reviewer). It's unclear whether that's a deliberate legal safeguard or just a technical limitation of an older system. Worth noting because it means we can't point to it as "proof that strict separation is the safe, validated choice" — its motivation is genuinely unknown.

---

## Implication for the unified-interface decision

This doesn't argue against unifying the interface — it argues for **which specific safeguards need to ship with it, not after it**:

1. Per-member, visible permissions (not a silent global "you manage everyone" toggle) — matches the EkaCare/MyChart pattern already recommended in `docs/ONBOARDING_RESEARCH.md`, and is also the consent-risk mitigation.
2. The patient/record-subject — whenever they're capable of using the app at all — must always be able to see who has access to their record and revoke it themselves, independent of the coordinator. This should be treated as a hard requirement of the design, not a follow-on feature.
3. Track *why* a coordinator has access at grant time (patient invited them directly vs. coordinator self-attesting authority because the patient was incapacitated at signup) — mirroring CareZone's self-attestation honesty, but making the two cases distinguishable rather than collapsing them, so there's a record of which consent model applied. This is a small schema/UX addition (e.g., a field on the invite/grant), not a redesign.
4. Don't build toward ABDM/DPDP-specific compliance automation now — the law itself doesn't have a clean answer for this use case yet, and CLAUDE.md Hard Rule 10 already excludes ABDM integration from V1 for unrelated reasons. Treat "let the patient see and revoke access" as the actionable mitigation available today, not a future compliance integration.
