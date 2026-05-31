"use client";

import { useState, useTransition } from "react";
import { setUserSubscription, saveConfigAction } from "@/lib/actions/admin";
import { useToast } from "@/app/components/useToast";
import { Toast } from "@/app/components/Toast";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailSubscribed: boolean;
}

export default function MailingListManager({
  users: initialUsers,
  subscribedCount: initialCount,
  groupEmails: initialGroupEmails,
}: {
  users: UserRow[];
  subscribedCount: number;
  groupEmails: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [groupEmails, setGroupEmails] = useState(initialGroupEmails);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savingGroup, startGroupSave] = useTransition();
  const { toast, show } = useToast();

  const subscribedCount = users.filter((u) => u.emailSubscribed).length;
  const groupCount = groupEmails.split(",").map((e) => e.trim()).filter(Boolean).length;

  async function toggleUser(user: UserRow) {
    const next = !user.emailSubscribed;
    setPendingId(user.id);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, emailSubscribed: next } : u))
    );
    try {
      await setUserSubscription(user.id, next);
      show({
        ok: true,
        message: next ? `${user.name} re-subscribed.` : `${user.name} removed from the list.`,
      });
    } catch {
      // revert on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, emailSubscribed: !next } : u))
      );
      show({ ok: false, message: "Could not update subscription." });
    } finally {
      setPendingId(null);
    }
  }

  function saveGroupEmails(e: React.FormEvent) {
    e.preventDefault();
    startGroupSave(async () => {
      const result = await saveConfigAction({ FEATURED_RECIPIENT_LIST: groupEmails });
      show(result.ok ? { ok: true, message: "Group emails saved." } : result);
    });
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      {/* Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-wrap gap-8">
        <div>
          <p className="text-2xl font-bold text-gray-900">{subscribedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Subscribed users</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{groupCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Group / distribution emails</p>
        </div>
      </div>

      {/* Group emails */}
      <form onSubmit={saveGroupEmails} className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Group / distribution emails
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Comma-separated addresses added on top of subscribed users (e.g. an org-wide
            distribution list). Duplicates are removed automatically.
          </p>
          <input
            type="text"
            value={groupEmails}
            onChange={(e) => setGroupEmails(e.target.value)}
            placeholder="everyone@yourcompany.com, team@yourcompany.com"
            disabled={savingGroup}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={savingGroup}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {savingGroup ? "Saving…" : "Save group emails"}
        </button>
      </form>

      {/* User list */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center text-sm text-gray-500">
          No users yet.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.emailSubscribed ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                        Subscribed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
                        Unsubscribed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      disabled={pendingId === u.id}
                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${
                        u.emailSubscribed ? "text-red-600" : "text-indigo-600"
                      }`}
                    >
                      {pendingId === u.id ? "…" : u.emailSubscribed ? "Remove" : "Add back"}
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
