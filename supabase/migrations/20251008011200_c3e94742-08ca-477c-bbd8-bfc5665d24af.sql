-- Drop the automatic trigger to prevent conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;