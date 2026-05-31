import { prisma } from "@/lib/prisma";
import ModerationClient from "./ModerationClient";

export const metadata = { title: "Admin — Moderation · SkillHub" };

export default async function ModerationPage() {
  const [skills, comments] = await Promise.all([
    prisma.skill.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { author: { select: { name: true } } },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user:  { select: { name: true } },
        skill: { select: { title: true } },
      },
    }),
  ]);

  return <ModerationClient skills={skills} comments={comments} />;
}
