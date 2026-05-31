import { auth, signOut } from "@/auth";
import Image from "next/image";

export default async function Nav() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 gap-4">
        {/* Left */}
        <div className="flex items-center gap-6">
          <a href="/" className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition">
            SkillHub
          </a>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/explore",      label: "Explore" },
              { href: "/leaderboards", label: "Leaderboards" },
              { href: "/import",       label: "Import" },
            ].map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <a
            href="/submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            + Submit
          </a>
          {user?.isAdmin && (
            <a href="/admin" className="text-xs text-gray-400 hover:text-gray-600">Admin</a>
          )}
          {user?.id && user?.image && (
            <div className="flex items-center gap-2">
              <a href={`/u/${user.id}`} title="Your profile">
                <Image
                  src={user.image}
                  alt={user.name ?? "avatar"}
                  width={30}
                  height={30}
                  className="rounded-full hover:ring-2 hover:ring-indigo-400 transition"
                />
              </a>
              <form action={async () => { "use server"; await signOut({ redirectTo: "/auth/signin" }); }}>
                <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
