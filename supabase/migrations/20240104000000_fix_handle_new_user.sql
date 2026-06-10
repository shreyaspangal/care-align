-- Rewrite handle_new_user with defensive NULL handling and correct ownership.
--
-- Root causes of "Database error saving new user":
-- 1. role cast fails when raw_user_meta_data->>'role' is NULL (NOT NULL violation)
-- 2. Function owner may not have INSERT on profiles
--
-- Fix: default role to 'coordinator' when absent, default name to 'Unknown'.
-- Grant INSERT to the function owner explicitly.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_name TEXT;
BEGIN
  -- Safely parse role — default coordinator if missing or invalid
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'coordinator';
  END;

  IF v_role IS NULL THEN
    v_role := 'coordinator';
  END IF;

  v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), 'Unknown');

  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, v_name, v_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure postgres owns it so SECURITY DEFINER runs with full privileges
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Grant execute to the auth hook system
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
