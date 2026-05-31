"use client";

import { useState, useEffect, useCallback } from "react";

interface Token {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function TokensPanel() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    const data = await res.json();
    if (res.ok) setTokens(data.tokens);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }
    setRawToken(data.token.rawToken);
    setNewName("");
    await load();
    setCreating(false);
  };

  const revoke = async (id: string) => {
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    setTokens(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Personal Access Tokens</h2>
      <p className="text-xs text-gray-400 mb-4">
        Use these tokens to import skills from the CLI:{" "}
        <code className="bg-gray-100 px-1 rounded">skillhub-import --token shpat_…</code>
      </p>

      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {rawToken && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs">
          <p className="font-semibold text-amber-800 mb-1">Save this token — it won&apos;t be shown again.</p>
          <code className="block break-all font-mono text-amber-900 select-all">{rawToken}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(rawToken); }}
            className="mt-2 text-amber-700 underline text-xs"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2 mb-4">
          {tokens.length === 0 && (
            <p className="text-xs text-gray-400">No tokens yet.</p>
          )}
          {tokens.map(t => (
            <div key={t.id} className="flex items-center justify-between text-sm border border-gray-100 rounded px-3 py-2">
              <div>
                <p className="font-medium text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-400">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt && ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => revoke(t.id)}
                className="text-xs text-red-500 hover:text-red-700 ml-4"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Token name (e.g. my-laptop)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && create()}
          className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          onClick={create}
          disabled={creating || !newName.trim()}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40"
        >
          {creating ? "Creating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
