"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSourceKey, type SkillOrigin, type ParsedSkillFile } from "@/lib/importUtils";

export type CandidateStatus = "new" | "updated" | "unchanged";

export interface ReviewCandidate extends ParsedSkillFile {
  sourceKey: string;
  status: CandidateStatus;
  existingSkillId?: string;
}

/** Given already-parsed skill files, return their new/updated/unchanged status for the review screen */
export async function classifyImportCandidates(
  files: ParsedSkillFile[]
): Promise<{ candidates: ReviewCandidate[] } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };
  const userId = session.user.id;

  const sourceKeys = files.map((f) => buildSourceKey(userId, f.origin, f.relativePath));

  const existing = await prisma.skill.findMany({
    where: { authorId: userId, sourceKey: { in: sourceKeys } },
    select: { id: true, sourceKey: true, contentHash: true },
  });

  const existingMap = new Map(existing.map((s) => [s.sourceKey!, s]));

  const candidates: ReviewCandidate[] = files.map((f, i) => {
    const sk = sourceKeys[i];
    const ex = existingMap.get(sk);
    let status: CandidateStatus;
    if (!ex) {
      status = "new";
    } else if (ex.contentHash === f.contentHash) {
      status = "unchanged";
    } else {
      status = "updated";
    }
    return { ...f, sourceKey: sk, status, existingSkillId: ex?.id };
  });

  return { candidates };
}
