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

function buildHtml(p: FeaturedEmailPayload): string {
  const { skill, author, creatorNote, appUrl } = p;
  const url = `${appUrl}/skill/${skill.id}`;
  const tags = skill.tags.map((t) => `<span style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:999px;font-size:12px;margin-right:4px">${t}</span>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:#4f46e5;padding:24px 32px">
          <p style="margin:0;color:#c7d2fe;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">Skill of the Month</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700">SkillHub</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 4px;font-size:20px;color:#111827">${skill.title}</h2>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280">by ${author.name} &nbsp;·&nbsp; ${skill.toolType}</p>
          <p style="margin:0 0 16px">${tags}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${skill.description}</p>

          <!-- Stats -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              ${stat("📋", skill.copies, "copies")}
              ${stat("▲", skill.upvotes, "upvotes")}
              ${stat("💬", skill.comments, "comments")}
            </tr>
          </table>

          ${creatorNote ? `
          <!-- Creator note -->
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em">From ${author.name}</p>
            <p style="margin:0;font-size:15px;color:#374151;font-style:italic">"${creatorNote}"</p>
          </div>` : ""}

          <!-- CTA -->
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
            View &amp; Copy Skill →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#9ca3af">You received this because you're part of the team. <a href="${appUrl}/explore" style="color:#6366f1">Browse all skills</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function stat(icon: string, n: number, label: string) {
  return `<td style="padding-right:24px;text-align:center">
    <p style="margin:0;font-size:22px">${icon}</p>
    <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827">${n}</p>
    <p style="margin:0;font-size:12px;color:#6b7280">${label}</p>
  </td>`;
}

export async function sendFeaturedEmail(
  payload: FeaturedEmailPayload,
  recipients: string[]
): Promise<{ ok: boolean; error?: string }> {
  const subject = `🌟 Skill of the Month: ${payload.skill.title}`;
  const html = buildHtml(payload);

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
