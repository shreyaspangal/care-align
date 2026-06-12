-- =============================================================================
-- Add classification columns to document_actions and pending_tasks.
--
-- Problem this solves:
--   document_actions had action_for but no category or phase_appears — making
--   it an incomplete audit record that required joining pending_tasks to answer
--   "what kind of action was this?"
--
--   pending_tasks had category and phase_appears but no action_for — making
--   it impossible to filter tasks by who they are assigned to (coordinator /
--   patient / both) without joining back to document_actions.
--
-- Both tables must be self-describing. Neither should require a join to the
-- other to answer basic questions about the actions it holds.
--
-- Write contract (set by the application at translate time, not by Claude):
--   category     → derived from document.type via lookup table in application code
--   phase_appears → derived from document.type + episode.care_ended_at
--   action_for   → comes from Claude's ActionSchema output (already set on
--                  document_actions; now also carried onto pending_tasks)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. document_actions — add category and phase_appears
--
-- DEFAULT values are required because the column is NOT NULL and the table
-- may have existing rows in production. 'medication' and 'during_care' are
-- the safest neutral defaults — they do not hide data and are clearly
-- placeholder values that will be replaced on re-translation.
--
-- Any rows inserted before this migration will show these defaults. In V1
-- there are no production rows (pipeline not yet built), so this is safe.
-- For future re-translations, the correct values will be set by the pipeline.
-- -----------------------------------------------------------------------------

ALTER TABLE document_actions
  ADD COLUMN category      task_category NOT NULL DEFAULT 'medication',
  ADD COLUMN phase_appears task_phase    NOT NULL DEFAULT 'during_care';

-- Index phase_appears for episode-scoped phase queries
-- (e.g. "all post_discharge actions across this episode's documents")
CREATE INDEX idx_document_actions_phase
  ON document_actions(phase_appears);

-- Composite index: translation + phase (most common query pattern in
-- TranslationOutputPanel — "show actions for this document in this phase")
CREATE INDEX idx_document_actions_translation_phase
  ON document_actions(translation_id, phase_appears);

-- -----------------------------------------------------------------------------
-- 2. pending_tasks — add action_for
--
-- DEFAULT 'coordinator' is safe: existing manually-created tasks (if any)
-- are coordinator tasks by definition. Claude-promoted tasks will always
-- have action_for set explicitly from the source document_action.
-- -----------------------------------------------------------------------------

ALTER TABLE pending_tasks
  ADD COLUMN action_for action_for NOT NULL DEFAULT 'coordinator';

-- Index for patient-view filtering: "show only tasks visible to this patient"
-- Patient view queries: WHERE episode_id = X AND action_for IN ('patient', 'both')
CREATE INDEX idx_pending_tasks_action_for
  ON pending_tasks(action_for);

-- Composite: episode + action_for + status (the patient task list query)
CREATE INDEX idx_pending_tasks_episode_actionfor_status
  ON pending_tasks(episode_id, action_for, status);
