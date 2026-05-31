import matter from "gray-matter";
import { createHash } from "crypto";
import path from "path";

export type SkillOrigin =
  | "claude-global"   // ~/.claude/skills
  | "claude-local"    // .claude/skills
  | "cursor-skills"   // .cursor/skills
  | "cursor-rules"    // .cursor/rules/*.mdc
  | "cursorrules"     // .cursorrules (single file)
  | "skillfile";      // any *.skill file

export interface ParsedSkillFile {
  origin: SkillOrigin;
  relativePath: string; // relative to the source dir, e.g. "myskill.md"
  title: string;
  description: string;
  content: string;      // raw file content (with frontmatter stripped from display, but stored as-is)
  toolType: "Claude" | "Cursor" | "Both";
  tags: string[];
  contentHash: string;
}

export interface ImportCandidate extends ParsedSkillFile {
  sourceKey: string; // authorId:origin:relativePath
  status: "new" | "updated" | "unchanged";
  existingSkillId?: string;
}

const ORIGIN_TOOL_DEFAULTS: Record<SkillOrigin, "Claude" | "Cursor" | "Both"> = {
  "claude-global": "Claude",
  "claude-local": "Claude",
  "cursor-skills": "Cursor",
  "cursor-rules": "Cursor",
  cursorrules: "Cursor",
  skillfile: "Both",
};

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function parseSkillFile(
  rawContent: string,
  origin: SkillOrigin,
  relativePath: string
): ParsedSkillFile {
  // Strip null bytes — Postgres UTF-8 rejects them
  // eslint-disable-next-line no-control-regex
  const sanitized = rawContent.replace(/\x00/g, "");
  const { data } = matter(sanitized);
  rawContent = sanitized;

  const baseName = path.basename(relativePath, path.extname(relativePath));
  const defaultTitle = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const toolDefault = ORIGIN_TOOL_DEFAULTS[origin];
  const rawToolType = (data.toolType ?? data.tool_type ?? data.tool ?? "").toString();
  let toolType: "Claude" | "Cursor" | "Both" = toolDefault;
  if (["Claude", "Cursor", "Both"].includes(rawToolType)) {
    toolType = rawToolType as "Claude" | "Cursor" | "Both";
  }

  const rawTags = data.tags ?? data.categories ?? [];
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.map(String).filter(Boolean)
    : String(rawTags)
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    origin,
    relativePath,
    title: String(data.title ?? data.name ?? defaultTitle).trim(),
    description: String(data.description ?? data.desc ?? "").trim(),
    content: rawContent,
    toolType,
    tags: tags.length > 0 ? tags : [origin.startsWith("cursor") ? "cursor" : "claude"],
    contentHash: sha256(rawContent),
  };
}

/** Build a sourceKey from its parts. The authorId is injected server-side. */
export function buildSourceKey(authorId: string, origin: SkillOrigin, relativePath: string): string {
  return `${authorId}:${origin}:${relativePath}`;
}
