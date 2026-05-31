/**
 * Org-wide featured email.
 *
 * Uses Resend when RESEND_API_KEY is set.
 * TODO: set RESEND_API_KEY in .env (get from resend.com).
 *       Also set RESEND_FROM_EMAIL to a verified sender, e.g. "skillhub@yourcompany.com".
 *
 * Without the key the email body is printed to the server console so you can
 * verify the content during development.
 */

import { render } from "@react-email/render";
import * as React from "react";
import FeaturedSkillEmail from "@/app/components/emails/FeaturedSkillEmail";

export interface FeaturedEmailPayload {
  skill: {
    id: string;
    title: string;
    description: string;
    toolType: string;
    tags: string[];
    copies: number;
    upvotes: number;
    comments: number;
  };
  author: { name: string };
  creatorNote: string | null;
  appUrl: string; // e.g. http://localhost:3000
}

async function buildHtml(p: FeaturedEmailPayload): Promise<string> {
  const { skill, author, creatorNote, appUrl } = p;
  const skillUrl = `${appUrl}/skill/${skill.id}`;
  const browseUrl = `${appUrl}/explore`;

  const element = React.createElement(FeaturedSkillEmail, {
    skillTitle: skill.title,
    authorName: author.name,
    toolType: skill.toolType as "Claude" | "Cursor" | "Both",
    tags: skill.tags,
    description: skill.description,
    creatorNote: creatorNote ?? undefined,
    copies: skill.copies,
    upvotes: skill.upvotes,
    comments: skill.comments,
    skillUrl,
    browseUrl,
  });

  return render(element);
}

export async function sendFeaturedEmail(
  payload: FeaturedEmailPayload,
  recipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  const subject = `🌟 Skill of the Month: ${payload.skill.title}`;
  const html = await buildHtml(payload);

  if (!process.env.RESEND_API_KEY) {
    // TODO: set RESEND_API_KEY in .env once you have a Resend account.
    console.log("\n========== FEATURED EMAIL (no RESEND_API_KEY — console only) ==========");
    console.log("Subject:", subject);
    console.log("To:", recipients.join(", "));
    console.log("HTML preview: check your admin email preview pane.");
    console.log("=======================================================================\n");
    return { ok: true };
  }

  // Real Resend send
  try {
    const from = process.env.RESEND_FROM_EMAIL ?? "SkillHub <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export { buildHtml };
