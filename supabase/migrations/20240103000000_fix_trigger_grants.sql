-- The handle_new_user trigger runs under supabase_auth_admin role.
-- That role needs INSERT on public.profiles for the trigger to work.
-- Without this, signUp throws "Database error saving new user" (code: unexpected_failure).

GRANT INSERT ON public.profiles TO supabase_auth_admin;

-- Also ensure the function is owned by postgres so SECURITY DEFINER works correctly
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
