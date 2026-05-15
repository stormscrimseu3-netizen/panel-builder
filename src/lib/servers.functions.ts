import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEgg, defaultEggVariables, renderStartup, validateEggVariables } from "./egg-catalog";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional(),
  memory_mb: z.number().int().min(128).max(8192),
  cpu_percent: z.number().int().min(10).max(400),
  eggId: z.string().min(1).max(120),
  variables: z.record(z.string(), z.string()),
  ownerUsername: z.string().trim().min(1).max(40).optional(),
});

export const createServerForOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    let ownerId = context.userId;

    if (data.ownerUsername) {
      // Admin path: lookup target user by username
      const { data: adminRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRow) throw new Error("Only admins can assign servers to other users.");

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .ilike("username", data.ownerUsername)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!profile) throw new Error(`No user found with username "${data.ownerUsername}".`);
      ownerId = profile.id;
    }

    const egg = getEgg(data.eggId);
    const merged = { ...defaultEggVariables(egg), ...data.variables };
    const variableError = validateEggVariables(egg, merged);
    if (variableError) throw new Error(variableError);

    // Separate secret values into files; keep non-secret vars in egg_variables
    const secretEnvs = new Set(egg.variables.filter((v) => v.secret).map((v) => v.env));
    const safeVars: Record<string, string> = {};
    const secretFiles: Array<{ path: string; content: string }> = [];
    for (const [k, v] of Object.entries(merged)) {
      if (secretEnvs.has(k) && v) {
        secretFiles.push({ path: `${k.toLowerCase()}.txt`, content: v });
        safeVars[k] = ""; // do not store secret in egg_variables
      } else {
        safeVars[k] = v;
      }
    }

    const startCommand = renderStartup(egg.startup, merged);

    const { data: server, error } = await supabaseAdmin
      .from("servers")
      .insert({
        name: data.name,
        description: data.description ?? null,
        memory_mb: data.memory_mb,
        cpu_percent: data.cpu_percent,
        runtime: egg.runtime,
        start_command: startCommand,
        egg_id: egg.id,
        egg_name: egg.name,
        egg_image: egg.image,
        egg_startup: egg.startup,
        egg_variables: safeVars,
        egg_secret_variables: egg.variables.filter((v) => v.secret).map((v) => v.env),
        user_id: ownerId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (secretFiles.length > 0) {
      const rows = secretFiles.map((f) => ({
        server_id: server.id,
        user_id: ownerId,
        path: f.path,
        content: f.content,
        size_bytes: new TextEncoder().encode(f.content).length,
      }));
      const { error: fileErr } = await supabaseAdmin.from("server_files").insert(rows);
      if (fileErr) throw new Error(fileErr.message);
    }

    return { id: server.id };
  });
