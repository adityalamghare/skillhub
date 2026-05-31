import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function SkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: { author: { select: { name: true, avatar: true } } },
  });

  if (!skill) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </a>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{skill.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          by {skill.author.name} · {skill.toolType} ·{" "}
          {skill.tags.map((t) => (
            <span key={t} className="mr-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
              {t}
            </span>
          ))}
        </p>
        {skill.description && (
          <p className="mt-4 text-gray-700">{skill.description}</p>
        )}
        <pre className="mt-6 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100 whitespace-pre-wrap">
          {skill.content}
        </pre>
        <p className="mt-6 text-xs text-gray-400 italic">
          Full skill detail page coming in slice 5.
        </p>
      </div>
    </div>
  );
}
