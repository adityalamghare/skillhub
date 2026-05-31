import { prisma } from "@/lib/prisma";
import { buildHtml } from "@/lib/email";
import EmailPreview from "./EmailPreview";

export const metadata = { title: "Admin — Featured Email · SkillHub" };

export default async function AdminFeaturedPage() {
  // Latest non-sent feature (pending_note or ready), or the most recent sent one
  const feature = await prisma.feature.findFirst({
    where: { status: { not: "sent" } },
    orderBy: { selectedAt: "desc" },
    include: {
      skill: {
        include: {
          author: { select: { name: true } },
          _count: { select: { votes: true, comments: true, copies: true } },
        },
      },
    },
  }) ?? await prisma.feature.findFirst({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    include: {
      skill: {
        include: {
          author: { select: { name: true } },
          _count: { select: { votes: true, comments: true, copies: true } },
        },
      },
    },
  });

  const allSkills = await prisma.skill.findMany({
    where: { hidden: false },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (!feature) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm text-gray-500 mb-1">No feature selected yet.</p>
        <p className="text-xs text-gray-400">
          Go to <a href="/admin" className="underline text-indigo-600">Selection</a> and run auto-selection or manually feature a skill.
        </p>
      </div>
    );
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const emailHtml = buildHtml({
    skill: {
      id:          feature.skill.id,
      title:       feature.skill.title,
      description: feature.skill.description,
      toolType:    feature.skill.toolType,
      tags:        feature.skill.tags,
      copies:      feature.skill._count.copies,
      upvotes:     feature.skill._count.votes,
      comments:    feature.skill._count.comments,
    },
    author:      feature.skill.author,
    creatorNote: feature.creatorNote,
    appUrl,
  });

  const statusLabel = {
    pending_note: "⏳ Waiting for creator note (48h window)",
    ready:        "✅ Ready to send",
    sent:         "✉️ Sent",
  }[feature.status];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Featured email</h1>
          <p className="mt-1 text-sm text-gray-500">
            Period: <span className="font-medium">{(feature as { period: string }).period}</span>
            {" · "}
            Status: <span className="font-medium">{statusLabel}</span>
            {" · "}
            Type: <span className="font-medium capitalize">{feature.type}</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Creator note page:{" "}
            <a
              href={`/creator-note/${feature.id}`}
              className="text-indigo-600 underline"
              target="_blank"
            >
              /creator-note/{feature.id}
            </a>
            {" "}(share with the author)
          </p>
        </div>
      </div>

      <EmailPreview
        feature={{
          id:          feature.id,
          status:      feature.status,
          creatorNote: feature.creatorNote,
          sentAt:      feature.sentAt,
          skill: {
            id:          feature.skill.id,
            title:       feature.skill.title,
            description: feature.skill.description,
            toolType:    feature.skill.toolType,
            tags:        feature.skill.tags,
            author:      feature.skill.author,
            _count:      feature.skill._count,
          },
        }}
        allSkills={allSkills}
        emailHtml={emailHtml}
      />
    </div>
  );
}
