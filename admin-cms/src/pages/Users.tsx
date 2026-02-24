import { useEffect, useState } from "react";
import api from "../api";
import useAdminAuth from "../hooks/useAdminAuth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  last_login?: string | null;
  source?: string;
  disabled?: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<Record<string, { role: string; disabled: boolean }>>({});
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { user: currentUser } = useAdminAuth();

  const load = () => {
    api
      .get("/admin/users")
      .then((res) => setUsers(Array.isArray(res.data.users) ? res.data.users : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "superadmin") {
      setUsers([]);
      return;
    }
    load();
  }, [currentUser]);

  const queueChange = (user: User, changes: Partial<{ role: string; disabled: boolean }>) => {
    setPending((prev) => ({
      ...prev,
      [user.id]: {
        role: changes.role ?? prev[user.id]?.role ?? user.role,
        disabled: changes.disabled ?? prev[user.id]?.disabled ?? Boolean(user.disabled)
      }
    }));
  };

  const saveChanges = async (user: User) => {
    if (currentUser?.role !== "superadmin") return;
    const changes = pending[user.id];
    if (!changes) return;
    await api.put(`/admin/users/${user.id}`, { role: changes.role, disabled: changes.disabled });
    setPending((prev) => {
      const next = { ...prev };
      delete next[user.id];
      return next;
    });
    load();
  };

  const discardChanges = (userId: string) => {
    setPending((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const deleteUser = async (userId: string) => {
    if (currentUser?.role !== "superadmin") return;
    const confirmed = window.confirm("Delete this user? This cannot be undone.");
    if (!confirmed) return;
    await api.delete(`/admin/users/${userId}`);
    load();
  };

  const createLocalUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== "superadmin") return;
    setCreateMessage(null);
    setCreating(true);
    try {
      const res = await api.post("/admin/users/local", {
        username: newUser.username,
        password: newUser.password,
        role: newUser.role
      });
      setCreateMessage(`Created ${res.data?.user?.email || newUser.username}.`);
      setNewUser({ username: "", password: "", role: "user" });
      load();
    } catch (err: any) {
      const message = err?.response?.data?.error || "Failed to create user.";
      setCreateMessage(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="card">
      <h1>User Management</h1>
      {currentUser?.role !== "superadmin" ? (
        <p className="note">Only super admins can manage users.</p>
      ) : (
        <p className="note">Assign admin access to users who have logged in at least once.</p>
      )}
      {currentUser?.role !== "superadmin" ? null : (
        <>
          <form className="form" onSubmit={createLocalUser}>
            <h3>Create local user</h3>
            <input
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="planner">Planner</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <button type="submit" className="btn" disabled={creating}>
              {creating ? "Creating..." : "Create user"}
            </button>
            {createMessage && <p className="note">{createMessage}</p>}
          </form>
          <div className="list">
            {users.map((user) => (
              <div key={user.id} className="list-item">
                <div>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <small>Source: {user.source || "aad"}</small>
                  <small>Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}</small>
                </div>
                <div className="actions">
                  <select
                    value={pending[user.id]?.role ?? user.role}
                    onChange={(e) => queueChange(user, { role: e.target.value })}
                    disabled={currentUser?.role !== "superadmin"}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="planner">Planner</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={pending[user.id]?.disabled ?? Boolean(user.disabled)}
                      onChange={(e) => queueChange(user, { disabled: e.target.checked })}
                    />
                    <span>Disabled</span>
                  </label>
                  {pending[user.id] ? (
                    <>
                      <button className="btn" onClick={() => saveChanges(user)}>Confirm</button>
                      <button className="btn ghost" onClick={() => discardChanges(user.id)}>Cancel</button>
                    </>
                  ) : null}
                  {currentUser?.role === "superadmin" && (
                    <button className="btn ghost" onClick={() => deleteUser(user.id)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <p>No users found.</p>}
          </div>
        </>
      )}
    </section>
  );
}
