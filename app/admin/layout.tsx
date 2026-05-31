import { auth } from "@/auth";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/admin",             label: "Selection" },
  { href: "/admin/featured",    label: "Featured email" },
  { href: "/admin/moderation",  label: "Moderation" },
  { href: "/admin/config",      label: "Config" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <a href="/" className="text-base font-bold text-gray-900">SkillHub</a>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              Admin
            </span>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
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
          <span className="text-xs text-gray-400">{session.user.email}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
