"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { parseSkillFile, type SkillOrigin, type ParsedSkillFile } from "@/lib/importUtils";
import { classifyImportCandidates, type ReviewCandidate } from "@/lib/actions/import";

const TOOL_TYPES: ParsedSkillFile["toolType"][] = ["Claude", "Cursor", "Both"];

// Paths to scan inside a folder/zip upload
const ORIGIN_PATTERNS: { prefix: string; origin: SkillOrigin; ext: string[] }[] = [
  { prefix: ".claude/skills",  origin: "claude-local",   ext: [".md", ".skill"] },
  { prefix: ".cursor/skills",  origin: "cursor-skills",  ext: [".md", ".skill"] },
  { prefix: ".cursor/rules",   origin: "cursor-rules",   ext: [".mdc", ".md", ".skill"] },
  { prefix: ".cursorrules",    origin: "cursorrules",    ext: [".cursorrules", ""] },
];

function classifyPath(relativePath: string): SkillOrigin | null {
  const p = relativePath.replace(/\\/g, "/");
  for (const pat of ORIGIN_PATTERNS) {
    if (p.startsWith(pat.prefix + "/") || p === pat.prefix) {
      const ext = p.includes(".") ? p.slice(p.lastIndexOf(".")) : "";
      if (pat.ext.includes(ext) || pat.ext.includes("")) return pat.origin;
    }
  }
  // Loose .md / .mdc / .skill files not under a known prefix
  if (p.endsWith(".md") || p.endsWith(".mdc")) return "claude-local";
  if (p.endsWith(".skill")) return "skillfile";
  return null;
}

type Step = "pick" | "review" | "done";

function findSkillMarkdownEntry(zip: JSZip) {
  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  return (
    files.find((entry) => entry.name.replace(/\\/g, "/").endsWith("/SKILL.md")) ??
    files.find((entry) => entry.name.replace(/\\/g, "/") === "SKILL.md") ??
    files.find((entry) => /\.(md|mdc)$/i.test(entry.name))
  );
}

async function readImportFile(path: string, bytes: ArrayBuffer | Uint8Array): Promise<string> {
  if (!path.toLowerCase().endsWith(".skill")) {
    return new TextDecoder().decode(bytes);
  }

  try {
    const zip = await JSZip.loadAsync(bytes);
    const skillEntry = findSkillMarkdownEntry(zip);
    if (!skillEntry) {
      throw new Error("No markdown entry found in .skill package.");
    }
    return skillEntry.async("string");
  } catch {
    // Some legacy .skill files are plain text. Keep supporting them.
    return new TextDecoder().decode(bytes);
  }
}

export default function ImportClient() {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitResult, setSubmitResult] = useState<{ status: string; relativePath: string }[]>([]);

  const processFiles = useCallback(async (rawFiles: { path: string; content: string }[]) => {
    setLoading(true);
    setError(null);
    try {
      const parsed: ParsedSkillFile[] = [];
      for (const f of rawFiles) {
        const origin = classifyPath(f.path);
        if (!origin) continue;
        try {
          parsed.push(parseSkillFile(f.content, origin, f.path));
        } catch {
          // skip unparseable files
        }
      }
      if (parsed.length === 0) {
        setError("No supported skill files found. Expected .md, .mdc, or .skill files under .claude/skills, .cursor/skills, .cursor/rules, .cursorrules, or anywhere as *.skill.");
        return;
      }
      const result = await classifyImportCandidates(parsed);
      if ("error" in result) { setError(result.error); return; }
      setCandidates(result.candidates);
      // Pre-select new + updated
      setSelected(new Set(result.candidates.filter(c => c.status !== "unchanged").map(c => c.sourceKey)));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error scanning files.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFolderChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const raw: { path: string; content: string }[] = await Promise.all(
      files.map(async (f) => {
        const path = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name;
        return { path, content: await readImportFile(path, await f.arrayBuffer()) };
      })
    );
    await processFiles(raw);
  }, [processFiles]);

  const handleZipChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const raw: { path: string; content: string }[] = [];
      await Promise.all(
        Object.entries(zip.files).map(async ([name, entry]) => {
          if (entry.dir) return;
          const content = await readImportFile(name, await entry.async("uint8array"));
          raw.push({ path: name, content });
        })
      );
      await processFiles(raw);
    } catch {
      setError("Failed to read ZIP file.");
      setLoading(false);
    }
  }, [processFiles]);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const updateCandidateToolType = (sourceKey: string, toolType: ParsedSkillFile["toolType"]) => {
    setCandidates((prev) => prev.map((c) => c.sourceKey === sourceKey ? { ...c, toolType } : c));
    setSelected((prev) => new Set(prev).add(sourceKey));
  };

  const handleSubmit = async () => {
    const toImport = candidates.filter(c => selected.has(c.sourceKey));
    if (toImport.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: toImport.map(c => ({ origin: c.origin, relativePath: c.relativePath, content: c.content, toolType: c.toolType })),
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setError(`Server returned an unexpected response (HTTP ${res.status}). You may need to sign in again.`);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import failed."); return; }
      setSubmitResult(data.results);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: ReviewCandidate["status"]) => {
    const cls = status === "new"
      ? "bg-green-100 text-green-800"
      : status === "updated"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-500";
    return <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{status}</span>;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to home</Link>
      <h1 className="text-2xl font-semibold mb-1 mt-4">Bulk Import Skills</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload a folder or ZIP containing your <code>.claude/skills</code>, <code>.cursor/skills</code>,{" "}
        <code>.cursor/rules</code>, or <code>.cursorrules</code> files. Each file is classified as
        new, updated, or unchanged before any changes are made.
      </p>

      {error && (
        <div className="mb-6 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Step 1: Pick ──────────────────────────────────────────────────── */}
      {step === "pick" && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <p className="text-gray-600 mb-4 font-medium">Drop a folder</p>
            <p className="text-xs text-gray-400 mb-4">
              Selects your whole project / home directory — only skill paths are extracted.
            </p>
            <input
              ref={folderRef}
              type="file"
              // @ts-expect-error webkitdirectory is non-standard
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={handleFolderChange}
            />
            <button
              onClick={() => folderRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Scanning…" : "Choose Folder"}
            </button>
          </div>

          <div className="text-center text-gray-400 text-sm">or</div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <p className="text-gray-600 mb-4 font-medium">Upload a ZIP archive</p>
            <input
              ref={zipRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleZipChange}
            />
            <button
              onClick={() => zipRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Reading…" : "Choose ZIP"}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">Scanned paths inside the upload:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code>~/.claude/skills/*.md/.skill</code> (claude-global)</li>
              <li><code>.claude/skills/*.md/.skill</code> (claude-local)</li>
              <li><code>.cursor/skills/*.md/.skill</code> (cursor-skills)</li>
              <li><code>.cursor/rules/*.mdc/.skill</code> (cursor-rules)</li>
              <li><code>.cursorrules</code> (cursorrules)</li>
              <li>Any <code>*.skill</code> file anywhere in the upload</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Step 2: Review ────────────────────────────────────────────────── */}
      {step === "review" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="text-green-700 font-medium">{candidates.filter(c => c.status === "new").length} new</span>
              <span className="text-blue-700 font-medium">{candidates.filter(c => c.status === "updated").length} updated</span>
              <span>{candidates.filter(c => c.status === "unchanged").length} unchanged</span>
            </div>
            <button
              onClick={() => { setStep("pick"); setCandidates([]); setSelected(new Set()); setError(null); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Start over
            </button>
          </div>

          <div className="border rounded divide-y divide-gray-100 mb-6">
            {candidates.map(c => (
              <div
                key={c.sourceKey}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${
                  c.status === "unchanged" && !selected.has(c.sourceKey) ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.sourceKey)}
                  onChange={() => toggleSelect(c.sourceKey)}
                  className="mt-1 shrink-0"
                  aria-label={`Import ${c.title}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{c.title}</span>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.relativePath}</p>
                  {c.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      Tool
                      <select
                        value={c.toolType}
                        onChange={(e) => updateCandidateToolType(c.sourceKey, e.target.value as ParsedSkillFile["toolType"])}
                        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {TOOL_TYPES.map((toolType) => (
                          <option key={toolType} value={toolType}>{toolType}</option>
                        ))}
                      </select>
                    </label>
                    {c.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {selected.size} selected
            </p>
            <button
              onClick={handleSubmit}
              disabled={loading || selected.size === 0}
              className="px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40"
            >
              {loading ? "Importing…" : `Import ${selected.size} skill${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ──────────────────────────────────────────────────── */}
      {step === "done" && (
        <div>
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
            <p className="font-medium text-green-800 text-sm">
              Import complete — {submitResult.filter(r => r.status === "new").length} created,{" "}
              {submitResult.filter(r => r.status === "updated").length} updated.
            </p>
          </div>
          <div className="border rounded divide-y divide-gray-100 mb-6">
            {submitResult.map(r => (
              <div key={r.relativePath} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    r.status === "new"
                      ? "bg-green-100 text-green-800"
                      : r.status === "updated"
                      ? "bg-blue-100 text-blue-800"
                      : r.status.startsWith("error")
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-sm text-gray-600 truncate">{r.relativePath}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Link href="/explore" className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
              Browse Skills
            </Link>
            <button
              onClick={() => { setStep("pick"); setCandidates([]); setSelected(new Set()); setSubmitResult([]); }}
              className="px-4 py-2 border text-sm rounded hover:bg-gray-50"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
