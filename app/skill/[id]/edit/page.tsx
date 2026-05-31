import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SubmitForm from "@/app/submit/SubmitForm";

export const metadata = { title: "Edit Skill — SkillHub" };

export default async function EditSkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const skill = await prisma.skill.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, description: true, toolType: true, tags: true, authorId: true },
  });

  if (!skill) notFound();
  if (skill.authorId !== session.user.id && !session.user.isAdmin) {
    redirect(`/skill/${id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <a href={`/skill/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to skill
          </a>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Edit skill</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update your skill — changes are visible org-wide immediately.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <SubmitForm
            skillId={skill.id}
            initial={{
              title:       skill.title,
              content:     skill.content,
              description: skill.description,
              toolType:    skill.toolType,
              tags:        skill.tags,
            }}
          />
        </div>
      </div>
    </div>
  );
}
