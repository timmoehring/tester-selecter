"use client";

import { useState, useEffect } from "react";

interface GoldenTicket {
  id: string;
  email?: string;
  username?: string;
  priorityLevel: number;
  reason?: string;
  createdAt: string;
}

export default function GoldenTicketsPage() {
  const [entries, setEntries] = useState<GoldenTicket[]>([]);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [priorityLevel, setPriorityLevel] = useState(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/golden-tickets")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!email && !username) return;

    const res = await fetch("/api/golden-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, priorityLevel, reason }),
    });

    if (res.ok) {
      const entry = await res.json();
      setEntries([entry, ...entries]);
      setEmail("");
      setUsername("");
      setPriorityLevel(1);
      setReason("");
    }
  }

  async function removeEntry(id: string) {
    await fetch("/api/golden-tickets", {
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

    const res = await fetch("/api/golden-tickets", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      alert(`Imported ${data.count} entries`);
      const refreshed = await fetch("/api/golden-tickets").then((r) =>
        r.json()
      );
      setEntries(refreshed);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Golden Tickets</h1>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Add Priority Tester</h2>
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
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Priority Level
                </label>
                <select
                  value={priorityLevel}
                  onChange={(e) => setPriorityLevel(parseInt(e.target.value))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value={1}>1 (Normal)</option>
                  <option value={2}>2 (High)</option>
                  <option value={3}>3 (Highest)</option>
                </select>
              </div>
            </div>
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
              Add Golden Ticket
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Import from File</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Upload CSV/Excel with &quot;email&quot;, &quot;username&quot;, and optional &quot;priority&quot;
            columns
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No golden ticket entries.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Priority</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-4 py-2">{entry.email || "-"}</td>
                  <td className="px-4 py-2">{entry.username || "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.priorityLevel >= 3
                          ? "bg-warning/20 text-warning"
                          : entry.priorityLevel >= 2
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.priorityLevel}
                    </span>
                  </td>
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
