-- Add PIN verification columns to patient_invites.
--
-- pin_hash        — bcrypt hash of the 6-digit access code. NULL = no PIN required
--                   (coordinator opted out). Plaintext is never stored.
-- pin_attempts    — incremented atomically on each wrong guess.
-- pin_locked_at   — set when attempts reach 5; coordinator must generate a new invite.

ALTER TABLE public.patient_invites
  ADD COLUMN pin_hash      TEXT,
  ADD COLUMN pin_attempts  INT NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_at TIMESTAMPTZ;
