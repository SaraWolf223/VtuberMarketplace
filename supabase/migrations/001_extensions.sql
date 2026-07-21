-- Local Marketplace: required PostgreSQL extensions (Supabase cloud uses schema "extensions")
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
