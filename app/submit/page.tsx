import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SubmitForm from "./SubmitForm";

export const metadata = { title: "Submit a Skill — SkillHub" };

export default async function SubmitPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to home
          </a>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Submit a skill</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share your Claude or Cursor skill file with the team.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <SubmitForm />
        </div>
      </div>
    </div>
  );
}
