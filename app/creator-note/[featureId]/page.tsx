export const dynamic = "force-dynamic";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import NoteForm from "./NoteForm";

export const metadata = { title: "Add Your Note — SkillHub" };

export default async function CreatorNotePage({
  params,
}: {
  params: Promise<{ featureId: string }>;
}) {
  const { featureId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    include: { skill: { include: { author: { select: { id: true, name: true } } } } },
  });

  if (!feature) notFound();

  const isAuthor = feature.skill.author.id === session.user.id;
  const alreadySent = feature.status === "sent";

  const deadline = new Date(feature.selectedAt);
  deadline.setHours(deadline.getHours() + 48);
  const expired = new Date() > deadline;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            🌟 Skill of the Month
          </span>
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            Your skill is being featured!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{feature.skill.title}</span> was selected as this month&apos;s featured skill.
          </p>
        </div>

        {alreadySent ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            ✓ This feature has already been sent to the organisation.
            {feature.creatorNote && (
              <blockquote className="mt-2 border-l-2 border-green-400 pl-3 italic">
                &ldquo;{feature.creatorNote}&rdquo;
              </blockquote>
            )}
          </div>
        ) : !isAuthor ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            Only the skill author ({feature.skill.author.name}) can submit a note.
          </div>
        ) : expired && !feature.creatorNote ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            The 48h window has passed. The admin may still send the email without your note, but you can still submit one below and it will be included if they haven&apos;t sent yet.
          </div>
        ) : null}

        {!alreadySent && isAuthor && (
          <NoteForm
            featureId={featureId}
            defaultNote={feature.creatorNote ?? ""}
            deadline={deadline.toLocaleString()}
            expired={expired}
          />
        )}
      </div>
    </main>
  );
}
