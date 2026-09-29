-- Additive profile columns for skippable profile setup flow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS dining_budget text,
  ADD COLUMN IF NOT EXISTS spice_level smallint,
  ADD COLUMN IF NOT EXISTS dietary_needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS already_in_china boolean,
  ADD COLUMN IF NOT EXISTS profile_setup_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_full_name_len_chk,
  DROP CONSTRAINT IF EXISTS profiles_nationality_chk,
  DROP CONSTRAINT IF EXISTS profiles_phone_chk,
  DROP CONSTRAINT IF EXISTS profiles_dining_budget_chk,
  DROP CONSTRAINT IF EXISTS profiles_spice_level_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_len_chk CHECK (full_name IS NULL OR char_length(full_name) <= 120),
  ADD CONSTRAINT profiles_nationality_chk CHECK (nationality IS NULL OR char_length(nationality) BETWEEN 2 AND 2),
  ADD CONSTRAINT profiles_phone_chk CHECK (phone IS NULL OR char_length(phone) <= 32),
  ADD CONSTRAINT profiles_dining_budget_chk CHECK (dining_budget IS NULL OR dining_budget IN ('budget','mid','fine','luxury')),
  ADD CONSTRAINT profiles_spice_level_chk CHECK (spice_level IS NULL OR (spice_level >= 0 AND spice_level <= 4));