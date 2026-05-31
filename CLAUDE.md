# CLAUDE.md — SkillHub

Internal "Product Hunt for AI skills": employees publish Claude/Cursor skill files (`.md`), discover others', copy/adapt them, and discuss. Full requirements live in `SkillHub-Build-Spec.md` — read it first. `SkillHub.jsx` is a working reference implementation; use it for the Featured Score math and the featured-email flow.

**Guiding principle:** the unit of value is *reuse* (a copy by a non-author), not posting. When a ranking or default is ambiguous, optimize for copies.

## Stack
- Next.js (App Router) + TypeScript
- Prisma + Postgres
- NextAuth, Google provider, domain-restricted (`hd`)
- Tailwind (clean/functional — internal tool, no design system required)
- `react-markdown` + syntax highlighting; store and copy the **raw** `.md`
- Anthropic API for AI descriptions — **server-side only**
- Email: Resend (or org SMTP) for the org-wide featured send
- Deploy: Vercel

## Commands
- `npm run dev` — local dev
- `npm run build` — production build
- `npm test` — unit tests (the Featured Score must have tests)
- `npx prisma migrate dev` — apply schema changes

## Build order (one slice at a time; run + commit between each)
1. Scaffold + Prisma schema (spec §3) + booting placeholder home
2. Google SSO + User table (§2)
3. Submit + server-side AI description (§4.1)
4. Explore: search / filter / sort (§4.2)
5. Skill detail: markdown render, copy + counter + public who-copied list, upvote, threaded comments (§4.3)
6. Featured Score + eligibility, with unit tests (§5)
7. Featured email workflow + admin console (§4.5, §4.8)
8. Home dashboard, gamification, leaderboards, badges (§4.6, §4.7)
9. Bulk import: browser uploader + review screen, `/api/import` endpoint, CLI, PATs (§9)

Do not jump ahead. Get each slice running and ask me to test before moving on.

## Hard rules
- **Real integrations, not fakes.** Google OAuth and the org email send are real. Scaffold them with clearly-marked `// TODO` stubs and env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, etc.). Never simulate them with hardcoded mocks.
- **Secrets in `.env` only.** Never hardcode keys (incl. `ANTHROPIC_API_KEY`). Add `.env` to `.gitignore`. Keep an `.env.example` with placeholder values.
- **Do not build anything in "Out of scope for v1"** (spec §8): no versioning, collections, Slack, fork lineage, analytics dashboard, or who-copied opt-out.
- **Bulk import is in-scope** (spec §9): `sourceKey`, `contentHash`, PATs, `/import` page, `/api/import`, `cli/import.ts`.
- **Counters are derived** from Vote/Comment/CopyEvent tables, not stored denormalized.
- Ask before destructive DB operations (drops, resets) and before changing auth or scoring code in bulk.

## Featured Score — get this exactly right (spec §5)
```
score = copies×5 + comments×3 + uniqueCommenters×2 + upvotes×2
```
- Exclude the author's own copies, upvotes, and comments from all counts.
- `CopyEvent` is unique per (skill, user) → counter = distinct copiers; who-copied list shows each person once.
- Window: current calendar month for monthly featuring; rolling 7 days for "trending". Make the window a config flag.
- Eligible for auto-select only if: ≥5 distinct non-author copiers AND not featured (auto or manual) in the last **12 months** AND author is active.
- Tiebreaker order: unique copiers → total copies → unique commenters → most recent activity.
- Admin manual feature may bypass the 12-month cooldown (with a confirm). Score/logic is never shown to users; admin can see it.

## Conventions
- TypeScript strict; meaningful names; small components.
- Empty / loading / error states on every interactive surface (e.g. who-copied empty state, copy-to-clipboard fallback, AI-description retry).
- Log events for instrumentation (spec §7): `skill_submit`, `skill_view`, `copy`, `upvote`, `comment`, `feature_selected`, `email_sent`, `email_open`, `email_click`.
