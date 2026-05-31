import { auth, signOut } from "@/auth";
import Image from "next/image";

export default async function Home() {
  const session = await auth();
  const user = session!.user; // middleware guarantees session exists here

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">SkillHub</h1>
        <p className="text-sm text-gray-500 mb-8">
          Internal &ldquo;Product Hunt for AI skills&rdquo;
        </p>

        <div className="flex flex-col items-center gap-3 mb-8">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? "avatar"}
              width={56}
              height={56}
              className="rounded-full"
            />
          )}
          <div>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.isAdmin && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <a
            href="/explore"
            className="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white text-center hover:bg-indigo-700 transition"
          >
            Explore skills
          </a>
          <a
            href="/submit"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 text-center hover:bg-gray-50 transition"
          >
            + Submit a skill
          </a>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/auth/signin" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
