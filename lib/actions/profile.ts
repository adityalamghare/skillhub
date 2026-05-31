"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// User toggles their own featured-email subscription (opt in/out)
// ---------------------------------------------------------------------------
export async function setEmailSubscription(
  subscribed: boolean
): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Not signed in." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailSubscribed: subscribed },
  });

  revalidatePath(`/u/${session.user.id}`);
  return {
    ok: true,
    message: subscribed
      ? "You'll receive the monthly featured email."
      : "You've unsubscribed from the featured email.",
  };
}
