-- Fix missing grants that prevented handle_new_user trigger from inserting
-- into profiles, and service_role from accessing application tables.
--
-- Root cause: RLS was enabled on all tables but explicit GRANT statements
-- were missing. Postgres requires both: RLS policies for row-level filtering,
-- AND table-level GRANT for the role to access the table at all.

-- Allow authenticated users and service_role to use all application tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- Authenticated users: read/write access (RLS policies narrow this further)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anonymous: no access to application tables (auth routes only)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
