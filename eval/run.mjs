// The organize eval harness (PRACTICES §6, BUILD_PLAN Phase 2 "Test focus").
//
//   pnpm eval        live mode  — calls the real configured model
//                                 (lib/ai/models.ts, Hard Rule 12), scores the
//                                 output, writes eval/results/<ts>-<version>.json
//   pnpm eval:smoke  cached mode — replays each case's committed
//                                 cached-response.json through the SAME scorer.
//                                 No API key, no network, no cost. This is what
//                                 CI runs.
//
// WHAT CACHED MODE PROVES AND WHAT IT DOES NOT
// It proves the harness still works: cases load, responses still satisfy
// OrganizeSchema, the scorer computes what it did yesterday, and the boundary
// check still fires. It says NOTHING about whether the model or the prompt is
// any good — a cached response is a recording, not a measurement. Only a live
// run against real documents scores the product, and per DECISIONS.md D-004
// that run is only meaningful with AI_MODEL_TIER pointed at a schema-enforcing
// provider (not the dev-tier free model).
//
// It is written as .mjs, not .ts, because it is a script Node runs directly:
// the repo carries no tsx/ts-node/bundler and adding one for this would owe a
// DECISIONS.md entry (Hard Rule 14). Node strips the types off the `.ts`
// modules it imports; eval/loader.mjs teaches Node the `@/*` alias. See
// eval/README.md.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { EvalCaseSchema } from '../lib/eval/case.ts'
import { scoreCase } from '../lib/eval/score.ts'
import { OrganizeSchema } from '../lib/validation/schemas.ts'

const evalDir = import.meta.dirname
const casesDir = path.join(evalDir, 'cases')
const resultsDir = path.join(evalDir, 'results')

const mode = process.argv.includes('--mode=live') ? 'live' : 'cached'
const record = process.argv.includes('--record')

// ── Case loading ─────────────────────────────────────────────────────────────

function loadCases() {
  const cases = []
  for (const entry of readdirSync(casesDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (!entry.isDirectory()) continue
    const dir = path.join(casesDir, entry.name)
    const expectedPath = path.join(dir, 'expected.json')
    if (!existsSync(expectedPath)) continue

    const parsed = EvalCaseSchema.safeParse(JSON.parse(readFileSync(expectedPath, 'utf8')))
    if (!parsed.success) {
      throw new Error(
        `${path.relative(process.cwd(), expectedPath)} is not a valid eval case:\n` +
          JSON.stringify(parsed.error.issues, null, 2)
      )
    }
    if (parsed.data.case_id !== entry.name) {
      throw new Error(`case_id "${parsed.data.case_id}" does not match directory "${entry.name}"`)
    }
    cases.push({ ...parsed.data, dir })
  }
  if (cases.length === 0) throw new Error(`no eval cases found in ${casesDir}`)
  return cases
}

// ── Scorer self-check (cached mode only) ─────────────────────────────────────
//
// A cached response is a recording of what some model said on some day — it
// cannot tell CI whether the model is good, only whether OUR code still behaves.
// So the smoke's teeth are here: feed the scorer two outputs whose verdict is
// known by construction — one deliberately wrong on both axes, one exactly
// right — and assert it says so in both directions. A scorer that silently
// stopped detecting anything (or started failing everything) breaks this;
// neither would be caught by replaying fixtures alone.

function runScorerSelfCheck() {
  const failures = []

  const clean = OrganizeSchema.parse({
    readable: true,
    doc_type: 'lab_report',
    title: 'Self-check',
    title_is_guessed: true,
    document_date: '2026-06-02',
    doctor_name: null,
    facility_name: null,
    patient_name_as_written: null,
    what_it_says: 'This is a lab report listing four blood test results.',
    terms: [
      { term: 'HbA1c', plain_explanation: 'a blood test that reflects average blood sugar' },
    ],
    medications_as_written: [],
    tests_as_written: [
      { name: 'HbA1c', value: '6.8', unit: '%', reference_range: '4.0-5.6', flag_as_written: 'H' },
    ],
  })

  const cleanResult = scoreCase('scorer-self-check-clean', clean, {
    doc_type: 'lab_report',
    document_date: '2026-06-02',
    tests_as_written: [
      { name: 'HbA1c', value: '6.8', unit: '%', reference_range: '4.0-5.6', flag_as_written: 'H' },
    ],
  })
  if (!cleanResult.pass) failures.push('scorer failed an output that matches expectations exactly')
  if (cleanResult.boundaryViolations.length !== 0) {
    // Guards the "phrase-shaped, never bare words" rule: 'H' as a printed flag
    // and a neutral term definition must not trip the advisory scanner.
    failures.push(
      `false-positive boundary violation on clean output: ${JSON.stringify(cleanResult.boundaryViolations)}`
    )
  }
  if (cleanResult.accuracy.ratio !== 1) {
    failures.push(`expected 100% accuracy on clean output, got ${cleanResult.accuracy.ratio}`)
  }

  const deliberatelyBad = OrganizeSchema.parse({
    readable: true,
    doc_type: 'bill',
    title: 'Self-check',
    title_is_guessed: true,
    document_date: '2020-01-01',
    doctor_name: null,
    facility_name: null,
    patient_name_as_written: null,
    what_it_says: 'Your fasting glucose is high and above the normal range.',
    terms: [
      { term: 'HbA1c', plain_explanation: 'You should consult a doctor about this result.' },
      // CDSCO-grounded gap (D-014): no "you", no severity word — this is the
      // "inform of options for treating" shape the older patterns above miss.
      { term: 'Metformin', plain_explanation: 'Type 2 diabetes is typically managed with metformin and lifestyle changes.' },
    ],
    medications_as_written: [{ name: 'Ibuprofen', strength: null, frequency: null, form: null }],
    tests_as_written: [],
  })

  const result = scoreCase('scorer-self-check', deliberatelyBad, {
    doc_type: 'lab_report',
    document_date: '2026-06-02',
    // An honest gap — expected a real value, the model produced null — must
    // classify as an OMISSION, distinct from the wrong-value fabrications
    // above (D-014 / DPDP s.8(3)).
    doctor_name: 'Dr. Self-Check',
    medications_as_written: [],
  })

  if (result.pass) failures.push('scorer passed an output that is wrong on every axis')
  if (result.boundaryViolations.length < 2) {
    failures.push(
      `expected advisory language to be caught in both what_it_says and terms[0], got ${result.boundaryViolations.length} violation(s)`
    )
  }
  if (!result.boundaryViolations.some((v) => v.location === 'what_it_says')) {
    failures.push('advisory language in what_it_says was not detected')
  }
  if (!result.boundaryViolations.some((v) => v.location.startsWith('terms['))) {
    failures.push('advisory language in a term explanation was not detected')
  }
  // CDSCO-grounded pattern family (D-014): impersonal treatment-option prose
  // ("typically managed with") must be caught even with no "you" and no
  // severity word — this is the specific gap the research found unguarded.
  if (!result.boundaryViolations.some((v) => v.patternId === 'is-treated-with')) {
    failures.push('impersonal treatment-option language ("typically managed with") was not detected')
  }
  if (result.accuracy.passed !== 0) {
    failures.push(`expected 0 correct fields, got ${result.accuracy.passed}`)
  }
  // The hallucinated medication must be counted per FIELD (4: name, strength,
  // frequency, form) — the same weight a missing medication would get — not
  // as a single check. That's the fix for the "hallucinations score cheaper
  // than omissions" defect this self-check now guards against.
  if (result.accuracy.total !== 7) {
    failures.push(
      `expected 7 checks (3 scalars + 4 unexpected-medication fields), got ${result.accuracy.total}`
    )
  }
  // DPDP s.8(3) split (D-014): doc_type/document_date are wrong-but-present
  // values (fabrications); the fully-hallucinated medication's 4 fields are
  // ALSO fabrications, never omissions — this is a wrong-and-invented output,
  // not an honest gap. doctor_name is the one genuine omission (expected a
  // real value, got null) and must NOT be counted as a fabrication.
  if (result.accuracy.fabrications !== 6) {
    failures.push(`expected 6 fabrications (2 scalars + 4 medication fields), got ${result.accuracy.fabrications}`)
  }
  if (result.accuracy.omissions !== 1) {
    failures.push(`expected 1 omission (doctor_name), got ${result.accuracy.omissions}`)
  }

  if (failures.length) {
    console.error('scorer self-check FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    return false
  }
  console.log('scorer self-check ok (advisory language + field mismatches detected)\n')
  return true
}

// ── Producing an output for a case ───────────────────────────────────────────

async function outputForCase(evalCase, live) {
  if (!live) {
    const cachedPath = path.join(evalCase.dir, 'cached-response.json')
    if (!existsSync(cachedPath)) {
      return { ok: false, reason: `no cached-response.json (run \`pnpm eval\` to record one)` }
    }
    const cached = JSON.parse(readFileSync(cachedPath, 'utf8'))
    const parsed = OrganizeSchema.safeParse(cached.output ?? cached)
    if (!parsed.success) {
      return {
        ok: false,
        reason: `cached response no longer satisfies OrganizeSchema: ${JSON.stringify(parsed.error.issues)}`,
      }
    }
    return {
      ok: true,
      output: parsed.data,
      latencyMs: null,
      usage: null,
      recordedPromptVersion: cached.prompt_version ?? null,
    }
  }

  const { runOrganizeExtraction } = await import('../lib/ai/organize.ts')
  const bytes = new Uint8Array(readFileSync(path.join(evalCase.dir, evalCase.source_file)))
  const extraction = await runOrganizeExtraction(bytes, evalCase.mime_type)
  if (!extraction.success) return { ok: false, reason: extraction.reason }
  return {
    ok: true,
    output: extraction.data,
    latencyMs: extraction.latencyMs,
    usage: extraction.usage,
  }
}

// ── Reporting ────────────────────────────────────────────────────────────────

function printTable(rows) {
  const headers = ['case', 'result', 'accuracy', 'boundary']
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => String(row[i]).length))
  )
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ')
  console.log(line(headers))
  console.log(line(widths.map((width) => '-'.repeat(width))))
  for (const row of rows) console.log(line(row))
}

function printCaseDetail(score) {
  for (const violation of score.boundaryViolations) {
    console.log(
      `    BOUNDARY ${violation.category}/${violation.patternId} in ${violation.location}: "…${violation.excerpt}…"`
    )
  }
  const missed = [
    ...score.scalarChecks,
    ...score.arrayChecks.flatMap((arrayCheck) => arrayCheck.items.flatMap((item) => item.checks)),
  ].filter((check) => !check.match)
  for (const check of missed) {
    // FABRICATION printed louder than OMISSION — a wrong asserted value is
    // the DPDP s.8(3) accuracy breach (D-014); an honest null is a gap the
    // UI already renders truthfully ("Date unknown").
    const tag = check.kind === 'fabrication' ? 'FABRICATION' : 'OMISSION'
    console.log(
      `    ${tag} ${check.field}: expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(check.actual)}`
    )
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const live = mode === 'live'
const cases = loadCases()

// Imported unconditionally (not just in live mode) so cached mode can warn
// when a committed recording no longer matches the prompt actually in use —
// otherwise CI replays a response produced under a prompt that doesn't exist
// anymore and nothing ever notices.
const { ORGANIZE_PROMPT_VERSION } = await import('../lib/ai/organize-prompt.ts')

let promptVersion = 'cached'
let modelId = 'cached'
if (live) {
  const { activeModelId } = await import('../lib/ai/models.ts')
  promptVersion = ORGANIZE_PROMPT_VERSION
  modelId = activeModelId('organize')
}

console.log(`organize eval — mode=${mode}, ${cases.length} case(s)`)
if (live) {
  console.log(`prompt_version=${promptVersion}  model=${modelId}`)
  if (process.env.AI_MODEL_TIER !== 'production') {
    console.log(
      'WARNING: AI_MODEL_TIER is not "production". Per DECISIONS.md D-004 the dev tier\n' +
        '         points at a model that does not enforce the response schema — these\n' +
        '         scores are exploratory, not a real eval run.'
    )
  }
} else {
  console.log(
    'cached responses — proves the harness works, NOT that the model or prompt is good'
  )
}
if (cases.every((evalCase) => evalCase.placeholder)) {
  console.log(
    'NOTE: every case is a SYNTHETIC placeholder. The eval set is not real until\n' +
      '      10-15 anonymised founder documents replace these (eval/cases/README.md).'
  )
}
console.log('')

// Runs in BOTH modes, and before any case (live or cached): the self-check is
// pure and costs microseconds, so there is no reason to skip it in live mode.
// Live is the run whose output becomes the PRACTICES §6 regression baseline —
// a scorer broken by e.g. a narrowed ADVISORY_PATTERNS regex must never write
// a baseline before anyone finds out, and must never spend a live API call
// on cases whose verdict the scorer can no longer be trusted to compute.
const selfCheckOk = runScorerSelfCheck()
if (!selfCheckOk) {
  console.error('\nAborting before running any case — see scorer self-check failures above.')
  process.exit(1)
}

const rows = []
const caseResults = []
let failed = 0
let errored = 0
let boundaryViolationsInCache = 0

for (const evalCase of cases) {
  const produced = await outputForCase(evalCase, live)
  if (!produced.ok) {
    failed += 1
    errored += 1
    rows.push([evalCase.case_id, 'ERROR', '-', '-'])
    caseResults.push({ case_id: evalCase.case_id, error: produced.reason })
    console.log(`  ${evalCase.case_id}: ERROR — ${produced.reason}`)
    continue
  }

  const score = scoreCase(evalCase.case_id, produced.output, evalCase.expected)
  if (!score.pass) failed += 1

  // `pnpm eval -- --record` refreshes the fixtures CI replays. Recording is
  // opt-in so an ordinary live run can never quietly rewrite the baseline it
  // is being measured against. Scored FIRST and gated on a clean boundary
  // check: without this, `--record` would happily commit a boundary-violating
  // response as the permanent CI fixture, and cached mode's boundary gate
  // (below) would then pass forever on a leak baked into the repo itself.
  // A failed accuracy score is still recorded — that's expected model
  // behaviour worth having in the fixture; an advisory-language leak is not.
  if (live && record) {
    if (score.boundaryViolations.length > 0) {
      console.log(
        `  ${evalCase.case_id}: NOT recording — fresh response has ${score.boundaryViolations.length} boundary violation(s); fix the prompt or the case, don't bake a leak into the CI fixture.`
      )
    } else {
      writeFileSync(
        path.join(evalCase.dir, 'cached-response.json'),
        `${JSON.stringify(
          {
            recorded_at: new Date().toISOString(),
            prompt_version: promptVersion,
            model: modelId,
            source: 'live model call',
            output: produced.output,
          },
          null,
          2
        )}\n`
      )
    }
  }

  // Fabrication count surfaced separately in the table (not just in the
  // per-field detail above) — it's the number worth noticing at a glance,
  // per DPDP s.8(3) / D-014.
  const accuracyCell =
    `${score.accuracy.passed}/${score.accuracy.total} (${(score.accuracy.ratio * 100).toFixed(0)}%)` +
    (score.accuracy.fabrications > 0 ? ` [${score.accuracy.fabrications} fabricated]` : '')
  rows.push([
    evalCase.case_id,
    score.pass ? 'PASS' : 'FAIL',
    accuracyCell,
    score.boundaryViolations.length === 0 ? 'clean' : `${score.boundaryViolations.length} VIOLATION(S)`,
  ])
  caseResults.push({
    ...score,
    placeholder: evalCase.placeholder,
    latency_ms: produced.latencyMs,
    usage: produced.usage,
  })

  if (!score.pass) {
    console.log(`  ${evalCase.case_id}:`)
    printCaseDetail(score)
  }

  // Loud, not fatal: a mismatch means CI is replaying a response produced
  // under a prompt that no longer exists. It doesn't fail the run on its
  // own — an unrelated prompt bump elsewhere shouldn't force every fixture to
  // be re-recorded before CI goes green again — but it must not go unnoticed.
  if (!live && produced.recordedPromptVersion && produced.recordedPromptVersion !== ORGANIZE_PROMPT_VERSION) {
    console.log(
      `  ${evalCase.case_id}: WARNING — cached response was recorded under prompt_version ` +
        `"${produced.recordedPromptVersion}", current is "${ORGANIZE_PROMPT_VERSION}". Re-record with ` +
        `\`pnpm eval -- --record\` once a live run confirms the new prompt still passes.`
    )
  }

  if (!live && score.boundaryViolations.length > 0) {
    boundaryViolationsInCache += score.boundaryViolations.length
  }
}

console.log('')
printTable(rows)

const scored = caseResults.filter((result) => !result.error)
const overallRatio =
  scored.length === 0
    ? 0
    : scored.reduce((sum, result) => sum + result.accuracy.ratio, 0) / scored.length
console.log('')
console.log(
  `${cases.length - failed}/${cases.length} case(s) passed  ·  mean field accuracy ${(overallRatio * 100).toFixed(1)}%` +
    (live ? '' : '  (replayed from recordings — informational only)')
)

// Live runs are the ones worth keeping: PRACTICES §6 requires scores logged per
// prompt_version so a regression is a diff, not a memory. Cached runs record
// nothing — there is no measurement in them to log.
if (live) {
  mkdirSync(resultsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(resultsDir, `${stamp}-${promptVersion}.json`)
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        run_at: new Date().toISOString(),
        prompt_version: promptVersion,
        model: modelId,
        ai_model_tier: process.env.AI_MODEL_TIER ?? 'development',
        placeholder_eval_set: cases.every((evalCase) => evalCase.placeholder),
        cases_total: cases.length,
        cases_passed: cases.length - failed,
        mean_field_accuracy: overallRatio,
        results: caseResults,
      },
      null,
      2
    )}\n`
  )
  console.log(`wrote ${path.relative(process.cwd(), file)}`)
}

// Exit codes differ by mode ON PURPOSE.
//
// Live: a failing case is a failing eval — non-zero. This is the run that
// feeds the PRACTICES §6 gate ("no prompt or model change merges if the eval
// score regresses"); comparing this run's mean accuracy against the previous
// eval/results file is a human read of two JSONs, deliberately not automated
// while the eval set is placeholder data.
//
// Cached (CI): the ACCURACY scores printed above are replays of a recording,
// so gating CI on accuracy would gate on a model's behaviour on the day it
// was recorded — green or red for reasons no commit can change. CI fails on
// HARNESS breakage (the scorer's self-check, a cached response that no longer
// satisfies OrganizeSchema, a case that could not be replayed at all) AND on
// any boundary violation in a committed fixture — a recording that leaks
// advisory language is a defect in the REPO, not a fact about "the model
// today", and `--record` already refuses to introduce a new one (above); this
// is what stops one from being committed by hand instead.
if (!live) {
  const healthy = selfCheckOk && errored === 0 && boundaryViolationsInCache === 0
  console.log(
    healthy
      ? '\nharness healthy — schema, fixtures and scorer all intact (model quality NOT assessed here; run `pnpm eval`)'
      : boundaryViolationsInCache > 0
        ? `\nharness BROKEN — ${boundaryViolationsInCache} boundary violation(s) committed in cached-response.json fixture(s); re-record after fixing the prompt/case (see above)`
        : '\nharness BROKEN — see errors above'
  )
  process.exit(healthy ? 0 : 1)
}

process.exit(failed === 0 ? 0 : 1)
