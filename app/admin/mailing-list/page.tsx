export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import MailingListManager from "./MailingListManager";

export const metadata = { title: "Admin — Mailing list · SkillHub" };

export default async function MailingListPage() {
  const [users, config] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, emailSubscribed: true },
      orderBy: [{ emailSubscribed: "desc" }, { name: "asc" }],
    }),
    getConfig(),
  ]);

  const subscribedCount = users.filter((u) => u.emailSubscribed).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mailing list</h1>
        <p className="mt-1 text-sm text-gray-500">
          The monthly featured email goes to every subscribed user, plus any group/distribution
          addresses you add below. Removing a user turns off their subscription.
        </p>
      </div>

      <MailingListManager
        users={users}
        subscribedCount={subscribedCount}
        groupEmails={config.FEATURED_RECIPIENT_LIST}
      />
    </div>
  );
}
