import { getConfig } from "@/lib/config";
import ConfigForm from "./ConfigForm";

export const metadata = { title: "Admin — Config · SkillHub" };

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
      <ConfigForm initialConfig={config} />
    </div>
  );
}
