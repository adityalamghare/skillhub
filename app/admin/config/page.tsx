import { getConfig, CONFIG_KEYS } from "@/lib/config";
import { saveConfigAction } from "@/lib/actions/admin";

export const metadata = { title: "Admin — Config · SkillHub" };

const FIELD_META: Record<string, { label: string; description: string; type?: string }> = {
  SCORE_WEIGHT_COPIES:            { label: "Weight: copies",            description: "Points per non-author copy (default 5)" },
  SCORE_WEIGHT_COMMENTS:          { label: "Weight: comments",          description: "Points per non-author comment (default 3)" },
  SCORE_WEIGHT_UNIQUE_COMMENTERS: { label: "Weight: unique commenters", description: "Points per unique non-author commenter (default 2)" },
  SCORE_WEIGHT_UPVOTES:           { label: "Weight: upvotes",           description: "Points per non-author upvote (default 2)" },
  SCORE_MIN_COPIERS:              { label: "Min distinct copiers",       description: "Min unique non-author copiers for eligibility (default 5)" },
  FEATURED_SCORE_WINDOW:          { label: "Score window",              description: 'monthly | 7days | alltime', type: "text" },
  FEATURED_RECIPIENT_LIST:        { label: "Email recipient list",      description: "Comma-separated emails. Leave blank to send to all users.", type: "text" },
};

export default async function ConfigPage() {
  const config = await getConfig();

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Config</h1>
        <p className="mt-1 text-sm text-gray-500">
          These values override env vars and take effect immediately without a redeploy.
        </p>
      </div>

      <form
        action={async (fd: FormData) => {
          "use server";
          const entries: Record<string, string> = {};
          for (const key of CONFIG_KEYS) {
            const val = fd.get(key);
            if (typeof val === "string") entries[key] = val;
          }
          await saveConfigAction(entries as never);
        }}
        className="rounded-xl border border-gray-200 bg-white p-6 space-y-5"
      >
        {CONFIG_KEYS.map((key) => {
          const meta = FIELD_META[key] ?? { label: key, description: "" };
          return (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {meta.label}
              </label>
              <input
                type={meta.type ?? "number"}
                name={key}
                defaultValue={config[key]}
                min={meta.type ? undefined : 0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">{meta.description}</p>
            </div>
          );
        })}

        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
        >
          Save config
        </button>
      </form>
    </div>
  );
}
