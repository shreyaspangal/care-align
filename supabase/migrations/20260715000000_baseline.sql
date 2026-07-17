-- ============================================================================
-- CareAlign v2 — baseline schema
-- The only schema source. One family login (auth.users) → families → profiles
-- (members, NOT auth users) → documents / explanations / appointments.
--
-- TWO-LAYER DISCIPLINE (v1's hardest-won lesson — ANTI_PATTERNS.md §1):
-- every table gets BOTH table-level GRANTs AND RLS policies for every verb.
-- Either one missing = silent 0-row writes with { error: null }.
--
-- Enum-like fields use text + CHECK, not CREATE TYPE: doc types will evolve
-- with the eval set, and a CHECK can be replaced in one ALTER while enum
-- values can never be dropped (DECISIONS.md D-010).
-- ============================================================================

create extension if not exists pg_trgm;

-- ── families ────────────────────────────────────────────────────────────────
-- One row per auth user. Created by the register action via service client
-- (the row cannot pass RLS before it exists — same chicken-and-egg as v1).

create table families (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now()
);

alter table families enable row level security;

grant select, insert, update, delete on families to authenticated;
grant all on families to service_role;

create policy families_owner on families
  for all
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- ── current_family_id() ─────────────────────────────────────────────────────
-- Security-definer helper so RLS policies never join. Every other table's
-- policy is exactly: family_id = (select current_family_id()).

create function current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from families where owner_user_id = auth.uid()
$$;

revoke all on function current_family_id() from public;
grant execute on function current_family_id() to authenticated, service_role;

-- ── updated_at trigger helper ───────────────────────────────────────────────

create function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Family members. No logins, no roles. pin_hash is a privacy lock within the
-- family, not a security credential (SYSTEM_DESIGN §D) — never select it in
-- client-bound queries; DAL exposes `has_pin` only.

create table profiles (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  name       text not null,
  dob        date,
  sex        text check (sex in ('female', 'male', 'other')),
  color      text not null default 'accent',
  pin_hash   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create index profiles_family_idx on profiles (family_id);

alter table profiles enable row level security;

grant select, insert, update, delete on profiles to authenticated;
grant all on profiles to service_role;

create policy profiles_family on profiles
  for all
  using (family_id = (select current_family_id()))
  with check (family_id = (select current_family_id()));

-- ── documents ───────────────────────────────────────────────────────────────
-- One row per captured document. Capture is sacred: the pipeline may only
-- move status between 'uploaded' → 'organized' | 'needs_review'; it never
-- deletes. Extraction fields are verbatim-or-null — no defaults, ever.

create table documents (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families (id) on delete cascade,
  profile_id       uuid not null references profiles (id) on delete cascade,
  blob_key         text not null,
  mime_type        text not null,
  byte_size        integer not null check (byte_size > 0),
  width            integer,
  height           integer,
  status           text not null default 'uploaded'
                     check (status in ('uploaded', 'organized', 'needs_review')),
  doc_type         text
                     check (doc_type in ('prescription', 'lab_report', 'imaging_report',
                                         'discharge_summary', 'vaccination_record',
                                         'doctor_note', 'bill', 'other')),
  title            text,
  title_is_guessed boolean not null default false,
  document_date    date,          -- verbatim-or-null: never defaulted to captured_at
  doctor_name      text,          -- verbatim-or-null
  facility_name    text,          -- verbatim-or-null
  idempotency_key  text not null unique,   -- client-generated at submit; retry-safe
  captured_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  search_tsv       tsvector generated always as (
                     to_tsvector('simple',
                       coalesce(title, '') || ' ' ||
                       coalesce(doctor_name, '') || ' ' ||
                       coalesce(facility_name, '') || ' ' ||
                       coalesce(doc_type, ''))
                   ) stored
);

create trigger documents_updated_at
  before update on documents
  for each row execute function set_updated_at();

-- Timeline keyset pagination: (event date, id) per profile, newest first.
-- Event date = document_date, falling back to the capture day in IST (V1 is
-- India-first; a bare ::date cast is not IMMUTABLE and UTC would shift evening
-- captures to the previous day). Queries must use this exact expression.
create index documents_timeline_idx
  on documents (profile_id, (coalesce(document_date, (captured_at at time zone 'Asia/Kolkata')::date)) desc, id desc);
create index documents_family_idx on documents (family_id);
create index documents_search_idx on documents using gin (search_tsv);
create index documents_title_trgm_idx on documents using gin (title gin_trgm_ops);

alter table documents enable row level security;

grant select, insert, update, delete on documents to authenticated;
grant all on documents to service_role;

create policy documents_family on documents
  for all
  using (family_id = (select current_family_id()))
  with check (family_id = (select current_family_id()));

-- ── document_explanations ───────────────────────────────────────────────────
-- The explain-never-advise output. One per document (re-runs overwrite;
-- history lives in telemetry). Telemetry columns per PRACTICES §7.

create table document_explanations (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid not null references families (id) on delete cascade,
  document_id             uuid not null unique references documents (id) on delete cascade,
  prompt_version          text not null,
  model                   text not null,
  what_it_says            text not null,
  terms                   jsonb not null default '[]',
  medications_as_written  jsonb not null default '[]',
  tests_as_written        jsonb not null default '[]',
  latency_ms              integer,
  input_tokens            integer,
  output_tokens           integer,
  created_at              timestamptz not null default now(),
  search_tsv              tsvector generated always as (
                            to_tsvector('simple', coalesce(what_it_says, ''))
                          ) stored
);

create index document_explanations_family_idx on document_explanations (family_id);
create index document_explanations_search_idx on document_explanations using gin (search_tsv);

alter table document_explanations enable row level security;

grant select, insert, update, delete on document_explanations to authenticated;
grant all on document_explanations to service_role;

create policy document_explanations_family on document_explanations
  for all
  using (family_id = (select current_family_id()))
  with check (family_id = (select current_family_id()));

-- ── appointments ────────────────────────────────────────────────────────────

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families (id) on delete cascade,
  profile_id       uuid not null references profiles (id) on delete cascade,
  title            text not null,
  doctor_name      text,
  facility_name    text,
  scheduled_at     timestamptz not null,
  notes            text,
  status           text not null default 'upcoming'
                     check (status in ('upcoming', 'done', 'cancelled')),
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create index appointments_profile_idx on appointments (profile_id, scheduled_at desc);
create index appointments_family_idx on appointments (family_id);
-- Reminder cron scan: only unsent, upcoming appointments.
create index appointments_reminder_idx on appointments (scheduled_at)
  where reminder_sent_at is null and status = 'upcoming';

alter table appointments enable row level security;

grant select, insert, update, delete on appointments to authenticated;
grant all on appointments to service_role;

create policy appointments_family on appointments
  for all
  using (family_id = (select current_family_id()))
  with check (family_id = (select current_family_id()));
