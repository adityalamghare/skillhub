"use client";

import { useState, useTransition } from "react";
import { copySkillAction, toggleVoteAction, addCommentAction, deleteCommentAction } from "@/lib/actions/skill";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Copier {
  id: string;
  userId: string;
  createdAt: Date;
  user: { name: string; avatar: string | null };
}

interface CommentData {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  parentId: string | null;
  user: { name: string; avatar: string | null };
  replies: {
    id: string;
    body: string;
    createdAt: Date;
    userId: string;
    parentId: string | null;
    user: { name: string; avatar: string | null };
  }[];
}

interface Props {
  skillId: string;
  skillContent: string;
  authorId: string;
  currentUserId: string;
  initialVoted: boolean;
  initialVoteCount: number;
  copies: Copier[];
  comments: CommentData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ avatar, name }: { avatar: string | null; name: string }) {
  if (avatar?.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
    );
  }
  if (avatar) {
    // emoji avatar
    return <span className="text-xl leading-none flex-shrink-0">{avatar}</span>;
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
      {name[0]?.toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------
function CopyButton({ skillId, skillContent, count }: { skillId: string; skillContent: string; count: number }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, startTransition] = useTransition();

  async function handleCopy() {
    // Write to clipboard first; fall back gracefully
    try {
      await navigator.clipboard.writeText(skillContent);
    } catch {
      // clipboard not available — still log the copy event
    }
    startTransition(async () => {
      const result = await copySkillAction(skillId);
      if (result.ok) {
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
      } else {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    });
  }

  return (
    <button
      onClick={handleCopy}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
        ${state === "copied" ? "bg-green-600 text-white" : state === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white hover:bg-gray-800"}
        disabled:opacity-60`}
    >
      {state === "copied" ? "✓ Copied!" : state === "error" ? "Copy failed — paste manually" : `Copy skill · ${count}`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Vote button
// ---------------------------------------------------------------------------
function VoteButton({
  skillId,
  authorId,
  currentUserId,
  initialVoted,
  initialCount,
}: {
  skillId: string;
  authorId: string;
  currentUserId: string;
  initialVoted: boolean;
  initialCount: number;
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const isOwn = authorId === currentUserId;

  function handleVote() {
    if (isOwn) return;
    startTransition(async () => {
      const result = await toggleVoteAction(skillId);
      if (result.ok) {
        setVoted(result.voted);
        setCount((c) => c + (result.voted ? 1 : -1));
      }
    });
  }

  return (
    <button
      onClick={handleVote}
      disabled={pending || isOwn}
      title={isOwn ? "Cannot upvote your own skill" : voted ? "Remove upvote" : "Upvote"}
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition
        ${voted ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      ▲ {count}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Comment row (root or reply)
// ---------------------------------------------------------------------------
function CommentRow({
  comment,
  currentUserId,
  onReply,
}: {
  comment: CommentData | CommentData["replies"][number];
  currentUserId: string;
  onReply?: () => void;
}) {
  const [deleting, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);

  function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      const result = await deleteCommentAction(comment.id);
      if (result.ok) setDeleted(true);
    });
  }

  if (deleted) {
    return (
      <div className="flex gap-3 opacity-40 italic text-xs text-gray-400 py-1">
        Comment deleted.
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar avatar={comment.user.avatar} name={comment.user.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{comment.user.name}</span>
          <span className="text-xs text-gray-400">{fmtDate(comment.createdAt)}</span>
          {comment.userId === currentUserId && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-0.5 break-words">{comment.body}</p>
        {onReply && (
          <button onClick={onReply} className="text-xs text-gray-400 hover:text-indigo-600 mt-1">
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment input box
// ---------------------------------------------------------------------------
function CommentInput({
  skillId,
  parentId,
  placeholder,
  onDone,
}: {
  skillId: string;
  parentId?: string;
  placeholder: string;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addCommentAction(skillId, body, parentId);
      if (result.ok) {
        setBody("");
        onDone?.();
      } else {
        setError(result.error ?? "Failed to post comment.");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        disabled={pending}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
      />
      <button
        onClick={submit}
        disabled={!body.trim() || pending}
        className="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
      >
        {pending ? "…" : "Post"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment thread (root + one level of replies)
// ---------------------------------------------------------------------------
function CommentThread({ comment, skillId, currentUserId }: { comment: CommentData; skillId: string; currentUserId: string }) {
  const [replying, setReplying] = useState(false);

  return (
    <div className="space-y-3">
      <CommentRow comment={comment} currentUserId={currentUserId} onReply={() => setReplying((v) => !v)} />
      {comment.replies.map((r) => (
        <div key={r.id} className="ml-10">
          <CommentRow comment={r} currentUserId={currentUserId} />
        </div>
      ))}
      {replying && (
        <div className="ml-10">
          <CommentInput
            skillId={skillId}
            parentId={comment.id}
            placeholder="Write a reply…"
            onDone={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function SkillInteractions({
  skillId,
  skillContent,
  authorId,
  currentUserId,
  initialVoted,
  initialVoteCount,
  copies,
  comments,
}: Props) {
  const totalComments = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <CopyButton skillId={skillId} skillContent={skillContent} count={copies.length} />
        <VoteButton
          skillId={skillId}
          authorId={authorId}
          currentUserId={currentUserId}
          initialVoted={initialVoted}
          initialCount={initialVoteCount}
        />
      </div>

      {/* Who copied */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Who copied this ({copies.length})
        </h2>
        {copies.length === 0 ? (
          <p className="text-sm text-gray-400">Be the first to copy this skill.</p>
        ) : (
          <div className="space-y-2">
            {copies.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                <Avatar avatar={c.user.avatar} name={c.user.name} />
                <span className="font-medium">{c.user.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{fmtDate(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">Copies are visible org-wide by default.</p>
      </section>

      {/* Comments */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Discussion ({totalComments})
        </h2>
        <CommentInput skillId={skillId} placeholder="Share how you adapted this…" />
        <div className="mt-4 space-y-5 divide-y divide-gray-100">
          {comments.length === 0 && (
            <p className="text-sm text-gray-400 pt-2">No comments yet. Start the discussion.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="pt-4 first:pt-0">
              <CommentThread comment={c} skillId={skillId} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
