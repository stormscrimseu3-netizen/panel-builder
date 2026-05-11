ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS egg_id TEXT NOT NULL DEFAULT 'generic/nodejs',
  ADD COLUMN IF NOT EXISTS egg_name TEXT NOT NULL DEFAULT 'Node.js 20 Bot',
  ADD COLUMN IF NOT EXISTS egg_image TEXT NOT NULL DEFAULT 'node:20-bullseye',
  ADD COLUMN IF NOT EXISTS egg_startup TEXT NOT NULL DEFAULT 'node {{MAIN_FILE}}',
  ADD COLUMN IF NOT EXISTS egg_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS egg_secret_variables TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_servers_egg_id ON public.servers(egg_id);