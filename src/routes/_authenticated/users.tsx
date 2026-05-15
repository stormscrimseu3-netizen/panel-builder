import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  isCurrentUserAdmin,
  listUsers,
  createUserAsAdmin,
  deleteUserAsAdmin,
  getPublicSignupAllowed,
  setPublicSignupAllowed,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

type UserRow = {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  isAdmin: boolean;
};

function UsersPage() {
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const list = useServerFn(listUsers);
  const create = useServerFn(createUserAsAdmin);
  const remove = useServerFn(deleteUserAsAdmin);
  const getAllowed = useServerFn(getPublicSignupAllowed);
  const setAllowed = useServerFn(setPublicSignupAllowed);

  const [admin, setAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allowed, setAllowedState] = useState<boolean>(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const u = await list();
    setUsers(u as UserRow[]);
    const a = await getAllowed();
    setAllowedState(a.allowed);
  };

  useEffect(() => {
    checkAdmin()
      .then((r) => {
        setAdmin(r.isAdmin);
        if (r.isAdmin) refresh();
      })
      .catch(() => setAdmin(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (admin === null) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!admin)
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin access required.</p>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { email, password, username, makeAdmin } });
      toast.success("User created");
      setEmail(""); setUsername(""); setPassword(""); setMakeAdmin(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}?`)) return;
    try {
      await remove({ data: { userId: id } });
      toast.success("User deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const toggleSignup = async (next: boolean) => {
    setAllowedState(next);
    try {
      await setAllowed({ data: { allowed: next } });
      toast.success(next ? "Public registration enabled" : "Public registration disabled");
    } catch (err) {
      setAllowedState(!next);
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage panel accounts and registration.</p>
      </div>

      <div className="card-elevated flex items-center justify-between rounded-2xl p-5">
        <div>
          <h2 className="font-semibold">Allow public registration</h2>
          <p className="text-sm text-muted-foreground">
            When off, the signup page is disabled and only admins can create accounts.
          </p>
        </div>
        <Switch checked={allowed} onCheckedChange={toggleSignup} />
      </div>

      <form onSubmit={submit} className="card-elevated space-y-4 rounded-2xl p-5">
        <h2 className="font-semibold">Create user</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="u">Username</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e">Email</Label>
            <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Password</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="ma" checked={makeAdmin} onCheckedChange={setMakeAdmin} />
          <Label htmlFor="ma" className="cursor-pointer">Grant admin role</Label>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
      </form>

      <div className="card-elevated rounded-2xl p-5">
        <h2 className="mb-3 font-semibold">All users ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.username ?? "—"}</span>
                  {u.isAdmin && (
                    <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> admin</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onDelete(u.id, u.email)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
        </div>
      </div>
    </div>
  );
}
