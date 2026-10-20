-- Add the "super_admin" role to the user_role enum.
-- Kept in its own migration: a new enum value cannot be referenced in the same
-- transaction that adds it, so later migrations (and seeds) can rely on it safely.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
