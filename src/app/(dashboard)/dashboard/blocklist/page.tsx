"use client";

import { useState, useEffect } from "react";

interface BlocklistEntry {
  id: string;
  email?: string;
  username?: string;
  reason?: string;
  createdAt: string;
}

export default function BlocklistPage() {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blocklist")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!email && !username) return;

    const res = await fetch("/api/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, reason }),
    });

    if (res.ok) {
      const entry = await res.json();
      setEntries([entry, ...entries]);
      setEmail("");
      setUsername("");
      setReason("");
    }
  }

  async function removeEntry(id: string) {
    await fetch("/api/blocklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setEntries(entries.filter((e) => e.id !== id));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/blocklist", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      alert(`Imported ${data.count} entries`);
      // Refresh
      const refreshed = await fetch("/api/blocklist").then((r) => r.json());
      setEntries(refreshed);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Global Blocklist</h1>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Add form */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Add Entry</h2>
          <form onSubmit={addEntry} className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add to Blocklist
            </button>
          </form>
        </div>

        {/* File upload */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Import from File</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Upload a CSV/Excel with &quot;email&quot; and/or &quot;username&quot; columns
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No blocklist entries.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-4 py-2">{entry.email || "-"}</td>
                  <td className="px-4 py-2">{entry.username || "-"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.reason || "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
