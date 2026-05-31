#!/usr/bin/env node
/**
 * skillhub-import — bulk-import local skill files into SkillHub.
 *
 * Usage:
 *   npx tsx cli/import.ts --token shpat_… [--url https://skillhub.example.com] [--dry-run]
 *
 * Env vars (alternative to flags):
 *   SKILLHUB_TOKEN   personal access token
 *   SKILLHUB_URL     base URL of the SkillHub instance (default: http://localhost:3000)
 *
 * Scanned paths (relative to $HOME and CWD):
 *   ~/.claude/skills/**‌/*.md/.skill  → claude-global
 *   .claude/skills/**‌/*.md/.skill    → claude-local
 *   .cursor/skills/**‌/*.md/.skill    → cursor-skills
 *   .cursor/rules/**‌/*.mdc/.skill    → cursor-rules
 *   .cursorrules                      → cursorrules
 *   **‌/*.skill (anywhere in CWD)      → skillfile
 */

import fs from "fs";
import path from "path";
import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Inline gray-matter import (Node.js, CJS)
// ---------------------------------------------------------------------------
const matter: (content: string) => { data: Record<string, unknown>; content: string } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("gray-matter");

type SkillOrigin =
  | "claude-global"
  | "claude-local"
  | "cursor-skills"
  | "cursor-rules"
  | "cursorrules"
  | "skillfile";

interface FileEntry {
  origin: SkillOrigin;
  relativePath: string;
  content: string;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  let token = process.env.SKILLHUB_TOKEN ?? "";
  let url = process.env.SKILLHUB_URL ?? "http://localhost:3000";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--token" || args[i] === "-t") && args[i + 1]) {
      token = args[++i];
    } else if ((args[i] === "--url" || args[i] === "-u") && args[i + 1]) {
      url = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log([
        "Usage: skillhub-import [options]",
        "",
        "Options:",
        "  --token   <token>   Personal access token (or SKILLHUB_TOKEN env var)",
        "  --url     <url>     SkillHub base URL (default: http://localhost:3000)",
        "  --dry-run           Print files that would be imported without sending",
        "  --help              Show this help",
      ].join("\n"));
      process.exit(0);
    }
  }

  if (!token && !dryRun) {
    console.error("Error: --token or SKILLHUB_TOKEN is required.");
    process.exit(1);
  }

  return { token, url: url.replace(/\/$/, ""), dryRun };
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
function* walkDir(dir: string, exts: string[]): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full, exts);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      yield full;
    }
  }
}

function findSkillMarkdownEntry(zip: JSZip) {
  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  return (
    files.find((entry) => entry.name.replace(/\\/g, "/").endsWith("/SKILL.md")) ??
    files.find((entry) => entry.name.replace(/\\/g, "/") === "SKILL.md") ??
    files.find((entry) => /\.(md|mdc)$/i.test(entry.name))
  );
}

async function readImportFile(absPath: string): Promise<string> {
  const buffer = fs.readFileSync(absPath);
  if (!absPath.toLowerCase().endsWith(".skill")) {
    return buffer.toString("utf8");
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const skillEntry = findSkillMarkdownEntry(zip);
    if (!skillEntry) {
      throw new Error("No markdown entry found in .skill package.");
    }
    return skillEntry.async("string");
  } catch {
    // Some legacy .skill files are plain text. Keep supporting them.
    return buffer.toString("utf8");
  }
}

async function collectFiles(): Promise<FileEntry[]> {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const cwd = process.cwd();
  const files: FileEntry[] = [];

  async function add(absPath: string, origin: SkillOrigin, relPath: string) {
    try {
      const content = await readImportFile(absPath);
      files.push({ origin, relativePath: relPath, content });
    } catch {
      console.warn(`  [warn] Could not read ${absPath}`);
    }
  }

  const SKILL_EXTS = [".md", ".skill"];

  // ~/.claude/skills/**/*.md/.skill
  for (const abs of walkDir(path.join(home, ".claude", "skills"), SKILL_EXTS)) {
    await add(abs, "claude-global", path.relative(path.join(home, ".claude", "skills"), abs));
  }

  // .claude/skills/**/*.md/.skill  (relative to cwd)
  for (const abs of walkDir(path.join(cwd, ".claude", "skills"), SKILL_EXTS)) {
    await add(abs, "claude-local", path.relative(path.join(cwd, ".claude", "skills"), abs));
  }

  // .cursor/skills/**/*.md/.skill
  for (const abs of walkDir(path.join(cwd, ".cursor", "skills"), SKILL_EXTS)) {
    await add(abs, "cursor-skills", path.relative(path.join(cwd, ".cursor", "skills"), abs));
  }

  // .cursor/rules/**/*.mdc/.skill
  for (const abs of walkDir(path.join(cwd, ".cursor", "rules"), [".mdc", ".md", ".skill"])) {
    await add(abs, "cursor-rules", path.relative(path.join(cwd, ".cursor", "rules"), abs));
  }

  // **/*.skill anywhere in cwd (excluding already-covered dirs)
  const coveredDirs = new Set([
    path.join(cwd, ".claude", "skills"),
    path.join(cwd, ".cursor", "skills"),
    path.join(cwd, ".cursor", "rules"),
  ]);
  const seenPaths = new Set(files.map(f => f.relativePath));
  for (const abs of walkDir(cwd, [".skill"])) {
    const rel = path.relative(cwd, abs);
    if (!Array.from(coveredDirs).some(d => abs.startsWith(d + path.sep)) && !seenPaths.has(rel)) {
      await add(abs, "skillfile", rel);
    }
  }

  // .cursorrules (single file)
  const cursorrules = path.join(cwd, ".cursorrules");
  if (fs.existsSync(cursorrules)) {
    await add(cursorrules, "cursorrules", ".cursorrules");
  }

  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { token, url, dryRun } = parseArgs();
  const files = await collectFiles();

  if (files.length === 0) {
    console.log("No skill files found.");
    process.exit(0);
  }

  console.log(`Found ${files.length} file(s):`);
  for (const f of files) {
    const parsed = matter(f.content);
    const baseName = path.basename(f.relativePath, path.extname(f.relativePath));
    const title = String(parsed.data.title ?? parsed.data.name ?? baseName);
    console.log(`  [${f.origin}] ${f.relativePath} — "${title}"`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing sent.");
    process.exit(0);
  }

  console.log(`\nSending to ${url}/api/import …`);

  const res = await fetch(`${url}/api/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ files }),
  });

  let data: { results?: { relativePath: string; status: string; skillId: string }[]; error?: string };
  try {
    data = await res.json();
  } catch {
    console.error(`HTTP ${res.status}: unexpected response`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`Error: ${data.error ?? res.statusText}`);
    process.exit(1);
  }

  const results = data.results ?? [];
  const counts = { new: 0, updated: 0, unchanged: 0, error: 0 };
  for (const r of results) {
    const key = r.status.startsWith("error") ? "error" : (r.status as keyof typeof counts);
    counts[key] = (counts[key] ?? 0) + 1;
    const icon = r.status === "new" ? "+" : r.status === "updated" ? "~" : r.status.startsWith("error") ? "✗" : "=";
    console.log(`  [${icon}] ${r.relativePath} (${r.status})`);
  }

  console.log(`\nDone: ${counts.new} new · ${counts.updated} updated · ${counts.unchanged} unchanged${counts.error > 0 ? ` · ${counts.error} errors` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
