/**
 * Generates a 2-3 sentence practitioner summary of a skill.
 *
 * TODO: replace mock with real Anthropic call once ANTHROPIC_API_KEY is set:
 *
 *   import Anthropic from "@anthropic-ai/sdk";
 *   const client = new Anthropic();  // reads ANTHROPIC_API_KEY from env
 *   const msg = await client.messages.create({
 *     model: "claude-opus-4-5",
 *     max_tokens: 256,
 *     messages: [{
 *       role: "user",
 *       content: `Summarise this AI skill file in 2-3 sentences, practitioner-to-practitioner.
 *                 Explain what it does and when to use it.\n\n${content}`,
 *     }],
 *   });
 *   return (msg.content[0] as { text: string }).text.trim();
 */
export async function generateDescription(content: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    // Real call — swap mock out when key is present.
    // (Uncomment the block above and remove this branch.)
    return content.slice(0, 300).trimEnd() + (content.length > 300 ? "…" : "");
  }

  // Mock: echo the first 300 chars of content back as the description.
  await new Promise((r) => setTimeout(r, 600)); // simulate network delay
  return content.slice(0, 300).trimEnd() + (content.length > 300 ? "…" : "");
}
