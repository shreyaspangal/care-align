-- documents_timeline_idx's own comment says queries "must use this exact
-- expression" (coalesce(document_date, captured_at at IST)::date) -- but no
-- query ever actually used it. lib/dal/documents.ts's getDocuments ordered
-- by document_date desc nulls-last, then captured_at desc: two separate
-- columns, not the coalesce. That sorts every dated document above every
-- undated one regardless of true recency (an undated document captured
-- yesterday would sink below a dated one from six months ago), which is not
-- what a chronological timeline means and not what the index was built for.
--
-- Found while building the real timeline (keyset-paginated by event date,
-- docs/BUILD_PLAN.md Phase 3 item 1) -- PostgREST can only order/filter on a
-- real column, not an arbitrary SQL expression, so keyset pagination needs
-- the coalesce materialized as one.
--
-- A generated column replaces the bare expression index: same semantics,
-- but now a real, indexed column to paginate on.
--
-- No equivalent column on appointments: an appointments ∪ documents union
-- was the original plan here, but appointments have no way to get created
-- yet without a manual-entry form that just asks a family to retype
-- something they already have in a calendar app, with no reminder-sending
-- payoff to justify it (see lib/dal/timeline.ts). Deferred.

alter table documents
  add column event_date date generated always as (
    coalesce(document_date, (captured_at at time zone 'Asia/Kolkata')::date)
  ) stored;

drop index documents_timeline_idx;
create index documents_event_date_idx on documents (profile_id, event_date desc, id desc);
