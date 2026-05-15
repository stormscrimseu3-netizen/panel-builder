import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const getPublicSignupAllowed = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("allow_public_signup")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { allowed: data?.allow_public_signup ?? true };
  },
);

export const setPublicSignupAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ allowed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ allow_public_signup: data.allowed, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const ids = users.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, display_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      username: profiles?.find((p) => p.id === u.id)?.username ?? null,
      display_name: profiles?.find((p) => p.id === u.id)?.display_name ?? null,
      isAdmin: !!roles?.find((r) => r.user_id === u.id && r.role === "admin"),
    }));
  });

export const createUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(72),
      username: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/),
      makeAdmin: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, display_name: data.username },
    });
    if (error) throw new Error(error.message);
    if (data.makeAdmin && created.user) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" })
        .select();
    }
    return { id: created.user?.id ?? null };
  });

export const deleteUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete yourself.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const lookupUserIdByUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ username: z.string().trim().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error(`No user with username "${data.username}" found.`);
    return { userId: profile.id, username: profile.username };
  });
