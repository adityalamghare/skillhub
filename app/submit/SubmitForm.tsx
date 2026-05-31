"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import {
  generateDescriptionAction,
  checkDuplicatesAction,
  submitSkillAction,
  updateSkillAction,
} from "@/lib/actions/skill";

const TOOL_TYPES = ["Claude", "Cursor", "Both"] as const;

interface InitialValues {
  title: string;
  content: string;
  description: string;
  toolType: string;
  tags: string[];
}

export default function SubmitForm({
  skillId,
  initial,
}: {
  skillId?: string;
  initial?: InitialValues;
}) {
  const isEdit = !!skillId;
  const formRef = useRef<HTMLFormElement>(null);

  // Field state — seeded from initial values when editing
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [toolType, setToolType] = useState<string>(initial?.toolType ?? "Claude");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  // UI state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ id: string; title: string }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  // Duplicate check — debounced on title change
  useEffect(() => {
    if (!title.trim()) { setDuplicates([]); return; }
    const t = setTimeout(async () => {
      const results = await checkDuplicatesAction(title);
      setDuplicates(results);
    }, 500);
    return () => clearTimeout(t);
  }, [title]);

  // Tag helpers
  function addTag(value: string) {
    const tag = value.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Enter", ",", " "].includes(e.key)) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  // AI description
  async function handleGenerateDescription() {
    setAiError(null);
    setIsGenerating(true);
    const result = await generateDescriptionAction(content);
    setIsGenerating(false);
    if ("error" in result) {
      setAiError(result.error);
    } else {
      setDescription(result.description);
    }
  }

  // Submit
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const fd = new FormData();
    fd.set("title", title);
    fd.set("content", content);
    fd.set("description", description);
    fd.set("toolType", toolType);
    fd.set("tags", tags.join(","));

    startTransition(async () => {
      const result = isEdit
        ? await updateSkillAction(skillId!, fd)
        : await submitSkillAction(fd);
      if (result && "error" in result) setSubmitError(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">A similar skill already exists — view it first?</p>
          <ul className="space-y-0.5">
            {duplicates.map((d) => (
              <li key={d.id}>
                <a href={`/skill/${d.id}`} className="underline hover:text-amber-900">
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Code review prompt for TypeScript"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Tool type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tool <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          {TOOL_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="toolType"
                value={t}
                checked={toolType === t}
                onChange={() => setToolType(t)}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{t}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags <span className="text-red-500">*</span>
          <span className="ml-1 font-normal text-gray-400">(press Enter or comma to add)</span>
        </label>
        <div className="flex flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="hover:text-indigo-900 leading-none"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput) addTag(tagInput); }}
            placeholder={tags.length === 0 ? "code-review, typescript…" : ""}
            className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Skill content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Skill content (.md) <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          placeholder="Paste your Claude or Cursor skill file here…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* Description + AI button */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Description
            <span className="ml-1 font-normal text-gray-400">(shown on skill cards)</span>
          </label>
          <button
            type="button"
            onClick={handleGenerateDescription}
            disabled={isGenerating || !content.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? (
              <>
                <Spinner />
                Generating…
              </>
            ) : (
              <>✨ Generate with AI</>
            )}
          </button>
        </div>
        {aiError && <p className="mb-1 text-xs text-red-600">{aiError}</p>}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What does this skill do and when should you use it?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between gap-4">
        {!isEdit && (
          <p className="text-sm text-gray-400">
            Have many files?{" "}
            <a href="/import" className="text-indigo-600 hover:underline">
              Bulk import from your local skills folder
            </a>
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="ml-auto rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPending ? (isEdit ? "Saving…" : "Publishing…") : (isEdit ? "Save changes" : "Publish skill")}
        </button>
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}
