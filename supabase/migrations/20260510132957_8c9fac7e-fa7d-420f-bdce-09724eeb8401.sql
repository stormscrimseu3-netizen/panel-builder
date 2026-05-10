
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  fqdn TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 8443,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nodes viewable by owner" ON public.nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create nodes" ON public.nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nodes" ON public.nodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nodes" ON public.nodes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_nodes_updated_at
BEFORE UPDATE ON public.nodes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.servers ADD COLUMN node_uuid UUID REFERENCES public.nodes(id) ON DELETE SET NULL;
CREATE INDEX idx_servers_node_uuid ON public.servers(node_uuid);
