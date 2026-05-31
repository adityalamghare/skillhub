# SkillHub — Build Spec

> **Purpose of this doc:** input for an AI coding agent (Claude Code / Emergent). Written as buildable requirements, not a strategy deck.
> **What it is:** an internal "Product Hunt for AI skills" — employees publish their Claude/Cursor skill files (`.md`), discover others', copy/adapt them, and discuss.
> **Core principle that drives every ranking:** the unit of value is *reuse* (a copy by someone other than the author), not posting. Optimize surfaces for copies.

---

## 1. Recommended Stack

Swap freely, but build against this unless told otherwise:

- **Framework:** Next.js (App Router) + TypeScript
- **DB/ORM:** Postgres + Prisma (or Supabase)
- **Auth:** NextAuth with Google provider, `hd` hosted-domain restriction to the company domain(s)
- **Styling:** Tailwind. Internal tool — clean and functional, no strict design system required.
- **Markdown rendering:** `react-markdown` + syntax highlighting; store and copy the **raw** `.md`.
- **AI description:** Anthropic API, called **server-side** (key in env, never client).
- **Email:** Resend or the org SMTP / Google Workspace API for the org-wide send.
- **Deploy:** Vercel (or internal infra).

---

## 2. Auth & Access

- Google SSO only, restricted to company domain(s). No password accounts, no anonymous browsing.
- First login auto-creates a profile: name, email, avatar, department (pull from Google directory if available, else let user pick avatar + department).
- Allowed-domain list is admin-configurable.
- One role flag: `isAdmin` (env-seeded list of admin emails to start).

---

## 3. Data Model

```
User       id, email, name, avatar, department, isAdmin, createdAt
Skill      id, title, description, content (raw .md), toolType ['Claude'|'Cursor'|'Both'],
           tags string[], authorId -> User, createdAt, updatedAt
Vote       id, skillId, userId, createdAt        // unique (skillId, userId)
Comment    id, skillId, userId, body, parentId (nullable, 1 level of threading), createdAt, editedAt
CopyEvent  id, skillId, userId, createdAt        // unique (skillId, userId) — one per user
Feature    id, skillId, period (YYYY-MM), type ['auto'|'manual'], creatorNote (nullable),
           status ['pending_note'|'ready'|'sent'], selectedAt, sentAt (nullable), selectedBy -> User
```

Notes:
- `CopyEvent` is unique per (skill, user) so the copy counter = distinct copiers, and the "who copied" list shows each person once.
- All counters (upvotes, comments, copies) are **derived** from these tables, not stored denormalized (denormalize later only if needed for perf).

---

## 4. Features (functional requirements)

### 4.1 Submit a skill
- Fields: title, raw `.md` content (paste or upload), toolType, tags (≥1), description.
- **AI description:** "Generate with AI" button → server calls Anthropic API with the skill content, returns a 2–3 sentence practitioner-to-practitioner summary (what it does + when to use it). User can edit before publishing. Show loading + graceful error→retry.
- Validation: title, content, ≥1 tag required.
- On publish, skill is visible org-wide immediately (no draft/approval step).
- Duplicate detection is a soft warning only ("A similar skill exists — view it?"), never a block.
- Authors can edit their own skills.

### 4.2 Explore
- Card grid: title, description snippet, author, toolType badge, tags, and the three counters (upvotes / comments / copies).
- Full-text search across title, description, tags, content.
- Filters: toolType, tag. Sort: Trending (default) / Most copied / Newest / Most upvoted.
- Infinite scroll or pagination for large lists.

### 4.3 Skill detail
- Render the `.md` (syntax-highlighted).
- **Copy button:** copies raw `.md` to clipboard → logs a `CopyEvent` (dedup per user) → increments the copy counter → adds the user to the **public "Who copied this" list** (avatars + names + date). Copies are visible org-wide by default. Show a "Copied!" confirmation.
- **Upvote:** toggle, one per user, author cannot upvote own skill.
- **Comments:** threaded one level deep, edit/delete own, show author + timestamp.
- Sidebar shows the "Who copied this" list.

### 4.4 Featured engine (see §5 for the algorithm)
- A scheduled job runs on the 1st of each month, computes the hidden score, and auto-selects the top **eligible** skill as Skill of the Month → creates a `Feature` with status `pending_note`.
- The score and selection logic are **never shown to users**.
- Admin can also manually feature any skill at any time and trigger the email independently of the schedule.

### 4.5 Featured email workflow
1. Selection (auto or manual) creates a `Feature(status='pending_note')`.
2. Notify the creator: "Your skill is being featured — add a note." Creator has 48h to submit a `creatorNote` → status becomes `ready`. If the window lapses, allow sending without a note.
3. Admin reviews an assembled email (skill title, description, the three stats, creatorNote, "View & Copy" CTA), can edit copy or swap the selected skill, then sends org-wide → status `sent`, set `sentAt`.
4. The latest `sent`/`ready` feature drives the Home hero.

### 4.6 Home (gamified dashboard)
- **Hero:** current Skill of the Month, with the creator note inline.
- **Trending this week:** top by score over a 7-day window.
- **Top rated of all time:** top by copies.
- **Weekly stats strip:** copies this week, new skills, new comments, total skills.
- **Your impact:** copies + upvotes your skills received, skills shipped.
- **Badges:** First Skill, 100-Copies Club, Trendsetter (authored a featured skill), Conversationalist (≥5 comments). Show earned vs locked.

### 4.7 Leaderboards
- Most-copied creators, Highest upvotes received, Top submitters (by skill count). Top 5 each, exclude self-actions.

### 4.8 Admin console (admin-only)
- Run automatic selection on demand; view the eligible ranking with scores (admin-visible).
- Manually feature any skill; compose/preview/send the featured email; edit cadence and recipient list.
- Edit scoring weights and thresholds without a redeploy (config table or env).
- Moderation: hide/remove a skill or comment; manage allowed login domains.

---

## 5. Featured Score (exact)

```
FeaturedScore =
      copies            × 5
    + comments          × 3
    + uniqueCommenters  × 2
    + upvotes           × 2
```

- **Exclude the author's own copies, upvotes, and comments** from all counts.
- **Window:** for monthly featuring, score on activity **within the current calendar month**. (May run all-time during early low-volume weeks — make the window a config flag.) Trending-this-week uses the same formula over a rolling 7-day window.

**Eligibility for auto-selection (all must hold):**
- ≥ 5 distinct non-author copiers.
- **Not featured (auto OR manual) in the last 12 months.**
- Author is an active employee.

**Tiebreaker order:** unique copiers → total copies → unique commenters → most recent activity.

**Overrides & guardrails:**
- Admin manual feature may bypass the 12-month cooldown, but must confirm first.
- Self-actions never count (anti-gaming).
- Weights and the copier threshold are admin-tunable.

---

## 6. Screens

`/` Home · `/explore` browse+search · `/skill/[id]` detail · `/submit` submit/edit · `/u/[id]` profile · `/leaderboards` · `/admin` + `/admin/featured`.

Each interactive surface needs sensible empty, loading, and error states (e.g. empty "Who copied" → "Be the first to copy this"; copy-to-clipboard failure → manual-copy fallback; AI description failure → retry/manual). No formal Figma mocks required — internal tool.

---

## 7. Events to Instrument

Log: `skill_submit`, `skill_view`, `copy`, `upvote`, `comment`, `feature_selected`, `email_sent`, `email_open`, `email_click`. Primary metric to surface to admin: **copies per month by non-authors**.

---

## 8. Out of Scope for v1 (do not build yet)

Skill versioning/changelog, collections/folders, Slack notifications, fork/remix lineage, a full analytics dashboard, and any "who copied" opt-out (public by default now; revisit with HR/Legal later). Build the loop end-to-end first: SSO → submit (+AI desc) → browse → detail (copy/upvote/comment) → featured engine + email → home/leaderboards → admin.
