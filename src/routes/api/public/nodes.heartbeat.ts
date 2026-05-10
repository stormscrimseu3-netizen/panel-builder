// Public heartbeat endpoint — wings daemons POST here every 30s with their
// node id + token. We mark the node as online and update last_seen_at.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/nodes/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("missing token", { status: 401 });

        let body: { node_id?: string; version?: string };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        if (!body.node_id) return new Response("missing node_id", { status: 400 });

        const { data: node } = await supabaseAdmin
          .from("nodes")
          .select("id, token")
          .eq("id", body.node_id)
          .maybeSingle();

        if (!node || node.token !== token) return new Response("invalid", { status: 401 });

        await supabaseAdmin
          .from("nodes")
          .update({ online: true, last_seen_at: new Date().toISOString() })
          .eq("id", body.node_id);

        return Response.json({ ok: true });
      },
    },
  },
});
