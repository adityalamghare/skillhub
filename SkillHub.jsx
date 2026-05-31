import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Flame, ArrowBigUp, MessageSquare, Copy, Check, Search, Plus, Trophy,
  Sparkles, Send, Shield, LogOut, Home, Compass, User, Award, Mail,
  X, ChevronUp, Clock, TrendingUp, Crown, Wand2, AlertTriangle
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Persistent storage wrapper                                         */
/*  Uses the artifact platform's window.storage (shared across users)  */
/*  with an in-memory fallback so the app still runs anywhere.         */
/* ------------------------------------------------------------------ */
const memStore = new Map();
const hasWS = typeof window !== "undefined" && window.storage;
async function sget(key, shared, fallback) {
  try {
    if (hasWS) {
      const r = await window.storage.get(key, shared);
      return r ? JSON.parse(r.value) : fallback;
    }
    return memStore.has(key) ? JSON.parse(memStore.get(key)) : fallback;
  } catch {
    return fallback;
  }
}
async function sset(key, value, shared) {
  const v = JSON.stringify(value);
  try {
    if (hasWS) await window.storage.set(key, v, shared);
    else memStore.set(key, v);
  } catch (e) {
    console.error("storage set failed", e);
    memStore.set(key, v);
  }
}

/* Keys */
const K = {
  skills: "sh_skills",
  votes: "sh_votes",
  comments: "sh_comments",
  copies: "sh_copies",
  features: "sh_features",
  seeded: "sh_seeded",
};

/* ------------------------------------------------------------------ */
/*  Constants / config                                                 */
/* ------------------------------------------------------------------ */
const AVATARS = ["🦊", "🐙", "🦉", "🐼", "🦁", "🐧", "🦝", "🐳", "🦄", "🐝", "🦅", "🐢"];
const TOOL_TYPES = ["Claude", "Cursor", "Both"];
const TAG_OPTIONS = ["product", "design", "engineering", "data", "writing", "research", "ops", "qa"];

// Scoring weights (admin-tunable in production)
const W = { copies: 5, comments: 3, uniqueCommenters: 2, upvotes: 2 };
const MIN_DISTINCT_COPIERS = 3; // prototype threshold; production default = 5
const FEATURE_COOLDOWN_DAYS = 365; // a featured skill can't be auto-selected again for 12 months
const DAY = 86400000;

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const daysAgo = (n) => now() - n * DAY;
const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ------------------------------------------------------------------ */
/*  Tiny markdown renderer (safe, element-based — no innerHTML)        */
/* ------------------------------------------------------------------ */
function parseInline(text, kp = "") {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={kp + i++}>{t.slice(2, -2)}</strong>);
    else out.push(<code key={kp + i++} className="px-1 py-0.5 rounded bg-zinc-100 text-orange-700 text-[0.85em]">{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function Markdown({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={key++} className="bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-x-auto text-xs leading-relaxed my-2"><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      const lvl = line.match(/^#+/)[0].length;
      const txt = line.replace(/^#+\s/, "");
      const cls = lvl <= 1 ? "text-lg font-bold mt-3" : lvl === 2 ? "text-base font-bold mt-3" : "text-sm font-semibold mt-2";
      blocks.push(<p key={key++} className={cls + " text-zinc-900"}>{parseInline(txt, key + "h")}</p>);
      i++; continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(<li key={items.length} className="ml-1">{parseInline(lines[i].replace(/^[-*]\s/, ""), key + "li" + items.length)}</li>);
        i++;
      }
      blocks.push(<ul key={key++} className="list-disc list-inside text-sm text-zinc-700 space-y-1 my-2">{items}</ul>);
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    blocks.push(<p key={key++} className="text-sm text-zinc-700 leading-relaxed my-1">{parseInline(line, key + "p")}</p>);
    i++;
  }
  return <div>{blocks}</div>;
}

/* ------------------------------------------------------------------ */
/*  Seed data (cold-start) — only written if the DB is empty           */
/* ------------------------------------------------------------------ */
const SEED_USERS = [
  { id: "u_maya", name: "Maya R.", dept: "Design", avatar: "🦄" },
  { id: "u_dev", name: "Dev K.", dept: "Engineering", avatar: "🦊" },
  { id: "u_sara", name: "Sara T.", dept: "Product", avatar: "🦉" },
  { id: "u_om", name: "Om P.", dept: "Data", avatar: "🐙" },
  { id: "u_ria", name: "Ria N.", dept: "QA", avatar: "🐧" },
  { id: "u_jay", name: "Jay M.", dept: "Engineering", avatar: "🦝" },
];
function seedData() {
  const mk = (a, title, desc, content, tool, tags, ageDays) => ({
    id: uid(), title, description: desc, content, toolType: tool, tags,
    authorId: a.id, authorName: a.name, authorAvatar: a.avatar, createdAt: daysAgo(ageDays),
  });
  const [maya, dev, sara, om, ria, jay] = SEED_USERS;
  const skills = [
    mk(sara, "PRD Drafter", "Turns a one-line feature idea into a structured PRD with goals, non-goals, and success metrics. Great when you need a first draft fast.",
      "# PRD Drafter\n\nWhen the user gives a feature idea, produce a PRD with:\n\n- **TL;DR** — one paragraph\n- **Goals & non-goals**\n- **Success metrics**\n- **Open questions** with a recommended default for each\n\nKeep it decision-oriented. Lead with the answer.", "Claude", ["product", "writing"], 40),
    mk(dev, "Test-Case Generator", "Reads a function or user story and spits out edge cases + a table of test inputs/expected outputs. Saves a ton of QA back-and-forth.",
      "# Test-Case Generator\n\nGiven code or a story, list:\n\n1. Happy path\n2. Boundary values\n3. Invalid input\n4. Concurrency / race conditions\n\nReturn a table: `input | expected | rationale`.", "Cursor", ["engineering", "qa"], 12),
    mk(maya, "Figma Handoff Checklist", "Translates a user story into the exact list of screens and states a designer must draw. No prose, just the checklist.",
      "# Figma Handoff Checklist\n\nFrom a story, output 8 sections: entry points, exit points, default inputs, validations, micro-interactions, loading, error, success.\n\nEach line = one mock a designer opens Figma to draw.", "Claude", ["design", "product"], 6),
    mk(om, "SQL Explainer", "Paste a gnarly query and get a plain-English breakdown plus a suggestion for a missing index. Surprisingly good at CTEs.",
      "# SQL Explainer\n\nExplain the query step by step in plain English, then:\n\n- flag likely full scans\n- suggest indexes\n- rewrite for readability if helpful", "Both", ["data", "engineering"], 3),
    mk(ria, "Bug Report Polisher", "Takes messy bug notes and reshapes them into a clean repro: steps, expected, actual, environment.",
      "# Bug Report Polisher\n\nReshape notes into:\n\n- **Steps to reproduce**\n- **Expected**\n- **Actual**\n- **Environment**\n\nAsk for missing fields instead of guessing.", "Claude", ["qa", "engineering"], 2),
  ];
  const votes = [], comments = [], copies = [];
  const voters = [maya, dev, sara, om, ria, jay];
  // PRD Drafter: strong, well-rounded -> should be featurable
  const prd = skills[0];
  voters.slice(0, 6).forEach(u => { if (u.id !== prd.authorId) votes.push({ skillId: prd.id, userId: u.id }); });
  voters.slice(0, 5).forEach(u => { if (u.id !== prd.authorId) copies.push({ skillId: prd.id, userId: u.id, userName: u.name, userAvatar: u.avatar, ts: daysAgo(Math.random() * 20) }); });
  comments.push({ id: uid(), skillId: prd.id, userId: dev.id, userName: dev.name, userAvatar: dev.avatar, body: "Adapted this for incident postmortems — works great.", parentId: null, ts: daysAgo(8) });
  comments.push({ id: uid(), skillId: prd.id, userId: maya.id, userName: maya.name, userAvatar: maya.avatar, body: "The non-goals section is the part everyone forgets. Love it.", parentId: null, ts: daysAgo(5) });
  comments.push({ id: uid(), skillId: prd.id, userId: om.id, userName: om.name, userAvatar: om.avatar, body: "Could you add a metrics-tree variant?", parentId: null, ts: daysAgo(2) });
  // SQL Explainer: lots of recent copies (trending)
  const sql = skills[3];
  voters.slice(0, 4).forEach(u => { if (u.id !== sql.authorId) votes.push({ skillId: sql.id, userId: u.id }); });
  voters.slice(0, 4).forEach(u => { if (u.id !== sql.authorId) copies.push({ skillId: sql.id, userId: u.id, userName: u.name, userAvatar: u.avatar, ts: daysAgo(Math.random() * 3) }); });
  comments.push({ id: uid(), skillId: sql.id, userId: jay.id, userName: jay.name, userAvatar: jay.avatar, body: "Caught a missing index for me in seconds.", parentId: null, ts: daysAgo(1) });
  // Figma checklist: a few
  const fig = skills[2];
  voters.slice(0, 3).forEach(u => { if (u.id !== fig.authorId) votes.push({ skillId: fig.id, userId: u.id }); });
  voters.slice(0, 2).forEach(u => { if (u.id !== fig.authorId) copies.push({ skillId: fig.id, userId: u.id, userName: u.name, userAvatar: u.avatar, ts: daysAgo(Math.random() * 5) }); });
  // Test-case: some
  const tc = skills[1];
  voters.slice(0, 3).forEach(u => { if (u.id !== tc.authorId) votes.push({ skillId: tc.id, userId: u.id }); });
  voters.slice(0, 2).forEach(u => { if (u.id !== tc.authorId) copies.push({ skillId: tc.id, userId: u.id, userName: u.name, userAvatar: u.avatar, ts: daysAgo(Math.random() * 10) }); });
  return { skills, votes, comments, copies };
}

/* ------------------------------------------------------------------ */
/*  Aggregation helpers                                                */
/* ------------------------------------------------------------------ */
function aggregate(skill, db) {
  const ups = db.votes.filter(v => v.skillId === skill.id && v.userId !== skill.authorId).length;
  const cps = db.copies.filter(c => c.skillId === skill.id && c.userId !== skill.authorId);
  const cmts = db.comments.filter(c => c.skillId === skill.id && c.userId !== skill.authorId);
  const uniqueCommenters = new Set(cmts.map(c => c.userId)).size;
  const lastActivity = Math.max(skill.createdAt, ...cps.map(c => c.ts), ...cmts.map(c => c.ts), 0);
  return { upvotes: ups, copies: cps.length, copiers: cps, comments: cmts.length, uniqueCommenters, lastActivity };
}
function score(agg) {
  return agg.copies * W.copies + agg.comments * W.comments + agg.uniqueCommenters * W.uniqueCommenters + agg.upvotes * W.upvotes;
}
function recentlyFeatured(skillId, features) {
  return features.some(f => f.skillId === skillId && f.selectedAt >= daysAgo(FEATURE_COOLDOWN_DAYS / DAY * DAY / DAY * 0 + 365));
}
function wasFeaturedWithinCooldown(skillId, features) {
  return features.some(f => f.skillId === skillId && f.selectedAt >= now() - FEATURE_COOLDOWN_DAYS * DAY);
}

/* ------------------------------------------------------------------ */
/*  UI atoms                                                           */
/* ------------------------------------------------------------------ */
const Stat = ({ icon: Icon, value, active, onClick, title }) => (
  <button onClick={onClick} title={title} disabled={!onClick}
    className={`inline-flex items-center gap-1 text-sm rounded-md px-2 py-1 transition ${active ? "bg-orange-100 text-orange-700" : "text-zinc-500 hover:bg-zinc-100"} ${onClick ? "cursor-pointer" : "cursor-default"}`}>
    <Icon size={16} /> <span className="font-medium">{value}</span>
  </button>
);
const Pill = ({ children }) => (
  <span className="text-[11px] uppercase tracking-wide font-medium text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5">{children}</span>
);
const ToolBadge = ({ t }) => {
  const c = t === "Claude" ? "bg-orange-50 text-orange-700 border-orange-200" : t === "Cursor" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-violet-50 text-violet-700 border-violet-200";
  return <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${c}`}>{t}</span>;
};

/* ------------------------------------------------------------------ */
/*  Main App                                                           */
/* ------------------------------------------------------------------ */
export default function SkillHub() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [db, setDb] = useState({ skills: [], votes: [], comments: [], copies: [], features: [] });

  const loadDb = useCallback(async () => {
    let skills = await sget(K.skills, true, null);
    let votes = await sget(K.votes, true, []);
    let comments = await sget(K.comments, true, []);
    let copies = await sget(K.copies, true, []);
    let features = await sget(K.features, true, []);
    if (!skills) {
      const seed = seedData();
      skills = seed.skills; votes = seed.votes; comments = seed.comments; copies = seed.copies;
      await sset(K.skills, skills, true);
      await sset(K.votes, votes, true);
      await sset(K.comments, comments, true);
      await sset(K.copies, copies, true);
      await sset(K.features, [], true);
    }
    setDb({ skills, votes, comments, copies, features });
  }, []);

  useEffect(() => {
    (async () => {
      const m = await sget("me", false, null);
      setMe(m);
      await loadDb();
      setLoading(false);
    })();
  }, [loadDb]);

  /* ---- mutations (read-latest then write to limit races) ---- */
  const persist = async (patch) => {
    const next = { ...db, ...patch };
    setDb(next);
    if (patch.skills) await sset(K.skills, patch.skills, true);
    if (patch.votes) await sset(K.votes, patch.votes, true);
    if (patch.comments) await sset(K.comments, patch.comments, true);
    if (patch.copies) await sset(K.copies, patch.copies, true);
    if (patch.features) await sset(K.features, patch.features, true);
  };

  const toggleVote = async (skillId) => {
    const fresh = await sget(K.votes, true, db.votes);
    const exists = fresh.find(v => v.skillId === skillId && v.userId === me.id);
    const votes = exists ? fresh.filter(v => !(v.skillId === skillId && v.userId === me.id)) : [...fresh, { skillId, userId: me.id }];
    await persist({ votes });
  };
  const addComment = async (skillId, body, parentId = null) => {
    if (!body.trim()) return;
    const fresh = await sget(K.comments, true, db.comments);
    const comments = [...fresh, { id: uid(), skillId, userId: me.id, userName: me.name, userAvatar: me.avatar, body: body.trim(), parentId, ts: now() }];
    await persist({ comments });
  };
  const doCopy = async (skill) => {
    try { await navigator.clipboard.writeText(skill.content); } catch {}
    const fresh = await sget(K.copies, true, db.copies);
    if (!fresh.find(c => c.skillId === skill.id && c.userId === me.id)) {
      const copies = [...fresh, { skillId: skill.id, userId: me.id, userName: me.name, userAvatar: me.avatar, ts: now() }];
      await persist({ copies });
    }
  };
  const submitSkill = async (data) => {
    const fresh = await sget(K.skills, true, db.skills);
    const skill = { id: uid(), ...data, authorId: me.id, authorName: me.name, authorAvatar: me.avatar, createdAt: now() };
    await persist({ skills: [skill, ...fresh] });
    return skill.id;
  };

  /* ---- featured engine ---- */
  const eligibleAuto = useMemo(() => {
    return db.skills
      .map(s => ({ s, agg: aggregate(s, db) }))
      .filter(({ s, agg }) => agg.copies >= MIN_DISTINCT_COPIERS && !wasFeaturedWithinCooldown(s.id, db.features))
      .map(x => ({ ...x, sc: score(x.agg) }))
      .sort((a, b) => b.sc - a.sc || b.agg.copies - a.agg.copies || b.agg.uniqueCommenters - a.agg.uniqueCommenters || b.agg.lastActivity - a.agg.lastActivity);
  }, [db]);

  const runAutoSelect = async () => {
    if (!eligibleAuto.length) { alert("No eligible skill: needs ≥" + MIN_DISTINCT_COPIERS + " distinct copiers and not featured in the last 12 months."); return; }
    const winner = eligibleAuto[0].s;
    await createFeature(winner.id, "auto");
  };
  const createFeature = async (skillId, type) => {
    const fresh = await sget(K.features, true, db.features);
    const f = { id: uid(), skillId, period: new Date().toISOString().slice(0, 7), type, creatorNote: "", status: "pending_note", selectedAt: now(), sentAt: null };
    await persist({ features: [f, ...fresh] });
    setView("admin");
  };
  const setCreatorNote = async (featureId, note) => {
    const fresh = await sget(K.features, true, db.features);
    const features = fresh.map(f => f.id === featureId ? { ...f, creatorNote: note, status: "ready" } : f);
    await persist({ features });
  };
  const sendFeatureEmail = async (featureId) => {
    const fresh = await sget(K.features, true, db.features);
    const features = fresh.map(f => f.id === featureId ? { ...f, status: "sent", sentAt: now() } : f);
    await persist({ features });
  };

  const currentFeature = useMemo(() => {
    const sorted = [...db.features].sort((a, b) => b.selectedAt - a.selectedAt);
    return sorted.find(f => f.status === "sent") || sorted.find(f => f.status === "ready") || sorted[0] || null;
  }, [db.features]);

  /* ---- sign in ---- */
  const signIn = async (name, dept, avatar) => {
    const m = { id: "u_" + uid(), name, dept, avatar };
    setMe(m);
    await sset("me", m, false);
  };
  const signOut = async () => { setMe(null); await sset("me", null, false); setView("home"); };

  if (loading) return <div className="p-10 text-center text-zinc-400">Loading SkillHub…</div>;
  if (!me) return <SignIn onSignIn={signIn} />;

  const selected = db.skills.find(s => s.id === selectedId);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {/* top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setView("home")} className="flex items-center gap-2 mr-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-orange-600 text-white"><Flame size={18} /></span>
            <span className="font-serif text-xl font-bold tracking-tight">SkillHub</span>
          </button>
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <NavBtn active={view === "home"} onClick={() => setView("home")} icon={Home}>Home</NavBtn>
            <NavBtn active={view === "explore"} onClick={() => setView("explore")} icon={Compass}>Explore</NavBtn>
            <NavBtn active={view === "leaders"} onClick={() => setView("leaders")} icon={Trophy}>Leaders</NavBtn>
            {admin && <NavBtn active={view === "admin"} onClick={() => setView("admin")} icon={Shield}>Admin</NavBtn>}
          </nav>
          <div className="flex-1" />
          <button onClick={() => setView("submit")} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-orange-600 text-white rounded-lg px-3 py-1.5 hover:bg-orange-700">
            <Plus size={16} /> Submit
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
            <button onClick={() => setView("profile")} title={me.name} className="text-xl">{me.avatar}</button>
            <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer select-none" title="Demo only — role-gated in production">
              <input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} /> admin
            </label>
            <button onClick={signOut} title="Sign out" className="text-zinc-400 hover:text-zinc-700"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === "home" && <HomeView db={db} me={me} feature={currentFeature} go={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "explore" && <ExploreView db={db} go={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "leaders" && <LeadersView db={db} />}
        {view === "submit" && <SubmitView onSubmit={async (d) => { const id = await submitSkill(d); setSelectedId(id); setView("detail"); }} />}
        {view === "profile" && <ProfileView db={db} me={me} go={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "detail" && selected && (
          <DetailView skill={selected} db={db} me={me} admin={admin}
            onVote={() => toggleVote(selected.id)}
            onCopy={() => doCopy(selected)}
            onComment={(b, p) => addComment(selected.id, b, p)}
            onFeature={() => createFeature(selected.id, "manual")}
            back={() => setView("explore")} />
        )}
        {view === "admin" && admin && (
          <AdminView db={db} eligible={eligibleAuto} onRunAuto={runAutoSelect}
            onSetNote={setCreatorNote} onSend={sendFeatureEmail} me={me}
            go={(id) => { setSelectedId(id); setView("detail"); }} />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-zinc-400">
        Prototype • SSO stubbed (swap to Google OAuth in prod) • Featured email previewed, not sent • Data shared & persistent across users of this artifact
      </footer>
    </div>
  );
}

const NavBtn = ({ active, onClick, icon: Icon, children }) => (
  <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
    <Icon size={15} /> {children}
  </button>
);

/* ------------------------------------------------------------------ */
/*  Sign in (Google SSO stand-in)                                      */
/* ------------------------------------------------------------------ */
function SignIn({ onSignIn }) {
  const [name, setName] = useState("");
  const [dept, setDept] = useState("Product");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  return (
    <div className="min-h-screen grid place-items-center bg-zinc-50 px-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-7 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-orange-600 text-white"><Flame size={20} /></span>
          <span className="font-serif text-2xl font-bold">SkillHub</span>
        </div>
        <p className="text-sm text-zinc-500 mb-5">The company's home for Claude &amp; Cursor skills. Share what you've built, find what others have.</p>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <select value={dept} onChange={e => setDept(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm">
            {["Product", "Engineering", "Design", "Data", "QA", "Ops"].map(d => <option key={d}>{d}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)} className={`text-xl w-9 h-9 rounded-lg grid place-items-center ${avatar === a ? "bg-orange-100 ring-2 ring-orange-400" : "bg-zinc-100"}`}>{a}</button>
            ))}
          </div>
          <button disabled={!name.trim()} onClick={() => onSignIn(name.trim(), dept, avatar)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-800">
            <span className="bg-white text-zinc-900 rounded-sm w-4 h-4 grid place-items-center text-[11px] font-bold">G</span>
            Continue with Google
          </button>
          <p className="text-[11px] text-zinc-400 text-center">Prototype stand-in for Google Workspace SSO (company domain only in production).</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skill card                                                         */
/* ------------------------------------------------------------------ */
function SkillCard({ skill, db, go }) {
  const agg = aggregate(skill, db);
  return (
    <button onClick={() => go(skill.id)} className="text-left bg-white border border-zinc-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-sm transition w-full">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 leading-tight">{skill.title}</h3>
        <ToolBadge t={skill.toolType} />
      </div>
      <p className="text-sm text-zinc-500 mt-1.5 line-clamp-2">{skill.description}</p>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">{skill.tags.map(t => <Pill key={t}>{t}</Pill>)}</div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
        <div className="flex items-center gap-1 text-sm text-zinc-500"><span>{skill.authorAvatar}</span><span className="text-xs">{skill.authorName}</span></div>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <span className="inline-flex items-center gap-1"><ArrowBigUp size={15} />{agg.upvotes}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare size={14} />{agg.comments}</span>
          <span className="inline-flex items-center gap-1 text-orange-600 font-medium"><Copy size={14} />{agg.copies}</span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Home                                                               */
/* ------------------------------------------------------------------ */
function HomeView({ db, me, feature, go }) {
  const ranked = db.skills.map(s => ({ s, agg: aggregate(s, db) }));
  const trending = [...ranked].filter(x => x.agg.lastActivity >= daysAgo(7)).sort((a, b) => score(b.agg) - score(a.agg)).slice(0, 3);
  const topRated = [...ranked].sort((a, b) => b.agg.copies - a.agg.copies).slice(0, 4);
  const featuredSkill = feature ? db.skills.find(s => s.id === feature.skillId) : null;

  const weekCopies = db.copies.filter(c => c.ts >= daysAgo(7)).length;
  const weekSkills = db.skills.filter(s => s.createdAt >= daysAgo(7)).length;
  const weekComments = db.comments.filter(c => c.ts >= daysAgo(7)).length;

  const myCopies = db.copies.filter(c => db.skills.find(s => s.id === c.skillId)?.authorId === me.id).length;
  const myUpvotes = db.votes.filter(v => db.skills.find(s => s.id === v.skillId)?.authorId === me.id).length;

  return (
    <div className="space-y-7">
      {/* hero */}
      {featuredSkill ? (
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-6">
          <div className="flex items-center gap-2 text-orange-300 text-xs font-semibold uppercase tracking-wider mb-2"><Crown size={15} /> Skill of the Month</div>
          <button onClick={() => go(featuredSkill.id)} className="text-2xl font-serif font-bold hover:underline text-left">{featuredSkill.title}</button>
          <p className="text-zinc-300 text-sm mt-1 max-w-2xl">{featuredSkill.description}</p>
          {feature.creatorNote && (
            <div className="mt-4 border-l-2 border-orange-400 pl-3">
              <p className="text-xs text-orange-300 mb-0.5">What {featuredSkill.authorName} says</p>
              <p className="text-sm text-zinc-100 italic">"{feature.creatorNote}"</p>
            </div>
          )}
          <button onClick={() => go(featuredSkill.id)} className="mt-4 inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg px-3 py-1.5 text-sm font-semibold"><Copy size={15} /> View &amp; Copy</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          <Crown className="mx-auto mb-2 text-zinc-400" /> No Skill of the Month featured yet. An admin can run selection from the Admin tab.
        </div>
      )}

      {/* weekly stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Copies this week", v: weekCopies, i: Copy },
          { l: "New skills", v: weekSkills, i: Plus },
          { l: "New comments", v: weekComments, i: MessageSquare },
          { l: "Total skills", v: db.skills.length, i: Flame },
        ].map(x => (
          <div key={x.l} className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><x.i size={14} />{x.l}</div>
            <div className="text-2xl font-bold mt-1">{x.v}</div>
          </div>
        ))}
      </div>

      {/* trending */}
      <section>
        <h2 className="flex items-center gap-1.5 font-serif text-lg font-bold mb-3"><TrendingUp size={18} className="text-orange-600" /> Trending this week</h2>
        {trending.length ? (
          <div className="grid sm:grid-cols-3 gap-3">{trending.map(x => <SkillCard key={x.s.id} skill={x.s} db={db} go={go} />)}</div>
        ) : <p className="text-sm text-zinc-400">Nothing trending yet — be the first to copy a skill.</p>}
      </section>

      {/* top rated */}
      <section>
        <h2 className="flex items-center gap-1.5 font-serif text-lg font-bold mb-3"><Trophy size={18} className="text-orange-600" /> Top rated of all time</h2>
        <div className="grid sm:grid-cols-2 gap-3">{topRated.map(x => <SkillCard key={x.s.id} skill={x.s} db={db} go={go} />)}</div>
      </section>

      {/* your impact */}
      <section className="bg-white border border-zinc-200 rounded-xl p-5">
        <h2 className="font-serif text-lg font-bold mb-3">Your impact</h2>
        <div className="flex gap-6">
          <div><div className="text-2xl font-bold text-orange-600">{myCopies}</div><div className="text-xs text-zinc-500">copies of your skills</div></div>
          <div><div className="text-2xl font-bold text-orange-600">{myUpvotes}</div><div className="text-xs text-zinc-500">upvotes received</div></div>
          <div><div className="text-2xl font-bold text-orange-600">{db.skills.filter(s => s.authorId === me.id).length}</div><div className="text-xs text-zinc-500">skills shipped</div></div>
        </div>
        <Badges db={db} me={me} feature={feature} />
      </section>
    </div>
  );
}

function Badges({ db, me, feature }) {
  const mySkills = db.skills.filter(s => s.authorId === me.id);
  const myComments = db.comments.filter(c => c.userId === me.id).length;
  const myCopiesReceived = db.copies.filter(c => mySkills.find(s => s.id === c.skillId)).length;
  const wasFeatured = db.features.some(f => mySkills.find(s => s.id === f.skillId));
  const list = [
    { name: "First Skill", earned: mySkills.length >= 1, icon: "🌱" },
    { name: "100-Copies Club", earned: myCopiesReceived >= 100, icon: "💯" },
    { name: "Trendsetter", earned: wasFeatured, icon: "👑" },
    { name: "Conversationalist", earned: myComments >= 5, icon: "💬" },
  ];
  return (
    <div className="flex gap-2 mt-4 flex-wrap">
      {list.map(b => (
        <div key={b.name} title={b.name} className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border ${b.earned ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-zinc-50 border-zinc-200 text-zinc-300"}`}>
          <span className={b.earned ? "" : "grayscale opacity-50"}>{b.icon}</span> {b.name}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Explore                                                            */
/* ------------------------------------------------------------------ */
function ExploreView({ db, go }) {
  const [q, setQ] = useState("");
  const [tool, setTool] = useState("All");
  const [tag, setTag] = useState("All");
  const [sort, setSort] = useState("trending");

  const list = useMemo(() => {
    let arr = db.skills.map(s => ({ s, agg: aggregate(s, db) }));
    if (q.trim()) {
      const ql = q.toLowerCase();
      arr = arr.filter(({ s }) => (s.title + s.description + s.tags.join(" ") + s.content).toLowerCase().includes(ql));
    }
    if (tool !== "All") arr = arr.filter(({ s }) => s.toolType === tool || s.toolType === "Both");
    if (tag !== "All") arr = arr.filter(({ s }) => s.tags.includes(tag));
    const sorters = {
      trending: (a, b) => score(b.agg) - score(a.agg),
      copied: (a, b) => b.agg.copies - a.agg.copies,
      newest: (a, b) => b.s.createdAt - a.s.createdAt,
      upvoted: (a, b) => b.agg.upvotes - a.agg.upvotes,
    };
    return arr.sort(sorters[sort]);
  }, [db, q, tool, tag, sort]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-2.5 text-zinc-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search skills…"
            className="w-full border border-zinc-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <select value={tool} onChange={e => setTool(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-2 text-sm">
          {["All", ...TOOL_TYPES].map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={tag} onChange={e => setTag(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-2 text-sm">
          {["All", ...TAG_OPTIONS].map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="border border-zinc-300 rounded-lg px-2 py-2 text-sm">
          <option value="trending">Trending</option>
          <option value="copied">Most copied</option>
          <option value="newest">Newest</option>
          <option value="upvoted">Most upvoted</option>
        </select>
      </div>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{list.map(({ s }) => <SkillCard key={s.id} skill={s} db={db} go={go} />)}</div>
      ) : <p className="text-center text-zinc-400 py-10">No skills match. Try a different filter.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail                                                             */
/* ------------------------------------------------------------------ */
function DetailView({ skill, db, me, admin, onVote, onCopy, onComment, onFeature, back }) {
  const agg = aggregate(skill, db);
  const voted = db.votes.some(v => v.skillId === skill.id && v.userId === me.id);
  const copied = db.copies.some(c => c.skillId === skill.id && c.userId === me.id);
  const [justCopied, setJustCopied] = useState(false);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const featuredWithin = wasFeaturedWithinCooldown(skill.id, db.features);

  const roots = db.comments.filter(c => c.skillId === skill.id && !c.parentId).sort((a, b) => a.ts - b.ts);
  const repliesOf = (id) => db.comments.filter(c => c.parentId === id).sort((a, b) => a.ts - b.ts);

  return (
    <div>
      <button onClick={back} className="text-sm text-zinc-500 hover:text-zinc-900 mb-3">← Back</button>
      <div className="grid lg:grid-cols-3 gap-5">
        {/* main */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><h1 className="font-serif text-2xl font-bold">{skill.title}</h1><ToolBadge t={skill.toolType} /></div>
                <div className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1"><span>{skill.authorAvatar}</span>{skill.authorName} · {fmtDate(skill.createdAt)}</div>
              </div>
            </div>
            <p className="text-zinc-600 mt-3">{skill.description}</p>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">{skill.tags.map(t => <Pill key={t}>{t}</Pill>)}</div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-100">
              <button onClick={onVote} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition ${voted ? "bg-orange-600 text-white border-orange-600" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}>
                <ChevronUp size={16} /> {agg.upvotes}
              </button>
              <button onClick={async () => { await onCopy(); setJustCopied(true); setTimeout(() => setJustCopied(false), 1500); }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800">
                {justCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy skill · {agg.copies}</>}
              </button>
              {admin && (
                <button onClick={onFeature} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Crown size={15} /> Feature
                </button>
              )}
            </div>
            {admin && featuredWithin && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle size={13} /> Featured within the last 12 months — auto-selection would skip this; manual feature still allowed.</div>
            )}
          </div>

          {/* content */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-400 mb-2"><Wand2 size={13} /> Skill file</div>
            <Markdown text={skill.content} />
          </div>

          {/* comments */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h3 className="font-semibold mb-3">Discussion · {agg.comments}</h3>
            <div className="flex gap-2 mb-4">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder={replyTo ? "Write a reply…" : "Share how you adapted this…"}
                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button disabled={!comment.trim()} onClick={() => { onComment(comment, replyTo); setComment(""); setReplyTo(null); }}
                className="bg-orange-600 text-white rounded-lg px-3 text-sm font-medium disabled:opacity-40 hover:bg-orange-700"><Send size={15} /></button>
            </div>
            {replyTo && <div className="text-xs text-zinc-400 mb-2">Replying… <button onClick={() => setReplyTo(null)} className="underline">cancel</button></div>}
            <div className="space-y-4">
              {roots.length === 0 && <p className="text-sm text-zinc-400">No comments yet. Start the discussion.</p>}
              {roots.map(c => (
                <div key={c.id}>
                  <CommentRow c={c} onReply={() => setReplyTo(c.id)} />
                  {repliesOf(c.id).map(r => <div key={r.id} className="ml-7 mt-2"><CommentRow c={r} /></div>)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* sidebar: who copied */}
        <aside className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Copy size={14} /> Who copied this ({agg.copiers.length})</h3>
            {agg.copiers.length === 0 ? (
              <p className="text-sm text-zinc-400">Be the first to copy this skill.</p>
            ) : (
              <div className="space-y-2">
                {agg.copiers.slice().sort((a, b) => b.ts - a.ts).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{c.userAvatar}</span>
                    <span className="text-zinc-700">{c.userName}</span>
                    <span className="text-xs text-zinc-400 ml-auto">{fmtDate(c.ts)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-zinc-400 mt-3">Copies are visible org-wide by default.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CommentRow({ c, onReply }) {
  return (
    <div className="flex gap-2">
      <span className="text-lg">{c.userAvatar}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2"><span className="text-sm font-medium">{c.userName}</span><span className="text-xs text-zinc-400">{fmtDate(c.ts)}</span></div>
        <p className="text-sm text-zinc-700">{c.body}</p>
        {onReply && <button onClick={onReply} className="text-xs text-zinc-400 hover:text-orange-600 mt-0.5">Reply</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Submit                                                             */
/* ------------------------------------------------------------------ */
function SubmitView({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [toolType, setToolType] = useState("Claude");
  const [tags, setTags] = useState([]);
  const [genState, setGenState] = useState("idle"); // idle | loading | error

  const toggleTag = (t) => setTags(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]);

  const generateDesc = async () => {
    if (!content.trim()) return;
    setGenState("loading");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: `Write a 2-3 sentence, practitioner-to-practitioner description of what this Claude/Cursor skill does and when to use it. Plain, direct, no marketing fluff. Return only the description.\n\nSkill file:\n${content.slice(0, 4000)}` }],
        }),
      });
      const data = await res.json();
      const text = data.content.filter(b => b.type === "text").map(b => b.text).join(" ").trim();
      if (text) { setDescription(text); setGenState("idle"); } else setGenState("error");
    } catch {
      setGenState("error");
    }
  };

  const valid = title.trim() && content.trim() && tags.length;
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-serif text-2xl font-bold mb-4">Submit a skill</h1>
      <div className="space-y-4 bg-white border border-zinc-200 rounded-xl p-5">
        <Field label="Title">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. PRD Drafter"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </Field>
        <Field label="Skill file (.md content)">
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} placeholder="Paste your skill's markdown here…"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </Field>
        <Field label={<span className="flex items-center justify-between">Description
          <button onClick={generateDesc} disabled={!content.trim() || genState === "loading"}
            className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800 disabled:opacity-40">
            <Sparkles size={13} /> {genState === "loading" ? "Generating…" : "Generate with AI"}
          </button></span>}>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="A short blurb — or generate one from the file above."
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          {genState === "error" && <p className="text-xs text-red-500 mt-1">Couldn't generate — write one manually, or try again.</p>}
        </Field>
        <Field label="Tool type">
          <div className="flex gap-2">{TOOL_TYPES.map(t => (
            <button key={t} onClick={() => setToolType(t)} className={`px-3 py-1.5 rounded-lg text-sm border ${toolType === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 text-zinc-600"}`}>{t}</button>
          ))}</div>
        </Field>
        <Field label="Tags">
          <div className="flex flex-wrap gap-2">{TAG_OPTIONS.map(t => (
            <button key={t} onClick={() => toggleTag(t)} className={`px-2.5 py-1 rounded-full text-xs border ${tags.includes(t) ? "bg-orange-100 border-orange-300 text-orange-700" : "border-zinc-300 text-zinc-500"}`}>{t}</button>
          ))}</div>
        </Field>
        <button disabled={!valid} onClick={() => onSubmit({ title: title.trim(), content, description: description.trim() || title.trim(), toolType, tags })}
          className="w-full bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-orange-700">Publish skill</button>
      </div>
    </div>
  );
}
const Field = ({ label, children }) => (
  <div><label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>{children}</div>
);

/* ------------------------------------------------------------------ */
/*  Leaderboards                                                       */
/* ------------------------------------------------------------------ */
function LeadersView({ db }) {
  const byAuthor = {};
  db.skills.forEach(s => {
    const a = byAuthor[s.authorId] || (byAuthor[s.authorId] = { name: s.authorName, avatar: s.authorAvatar, skills: 0, copies: 0, upvotes: 0 });
    a.skills++;
  });
  db.copies.forEach(c => { const s = db.skills.find(x => x.id === c.skillId); if (s && c.userId !== s.authorId) byAuthor[s.authorId].copies++; });
  db.votes.forEach(v => { const s = db.skills.find(x => x.id === v.skillId); if (s && v.userId !== s.authorId && byAuthor[s.authorId]) byAuthor[s.authorId].upvotes++; });
  const arr = Object.values(byAuthor);
  const board = (title, key, icon) => (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <h3 className="flex items-center gap-1.5 font-semibold mb-3">{icon}{title}</h3>
      <div className="space-y-2">
        {[...arr].sort((a, b) => b[key] - a[key]).slice(0, 5).map((a, i) => (
          <div key={a.name} className="flex items-center gap-3 text-sm">
            <span className={`w-5 text-center font-bold ${i === 0 ? "text-orange-600" : "text-zinc-400"}`}>{i + 1}</span>
            <span className="text-lg">{a.avatar}</span><span className="flex-1">{a.name}</span>
            <span className="font-semibold text-zinc-700">{a[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold mb-4">Leaderboards</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        {board("Most-copied creators", "copies", <Copy size={16} className="text-orange-600" />)}
        {board("Highest upvotes received", "upvotes", <ArrowBigUp size={16} className="text-orange-600" />)}
        {board("Top submitters", "skills", <Crown size={16} className="text-orange-600" />)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile                                                            */
/* ------------------------------------------------------------------ */
function ProfileView({ db, me, go }) {
  const mine = db.skills.filter(s => s.authorId === me.id);
  const copied = db.copies.filter(c => c.userId === me.id).map(c => db.skills.find(s => s.id === c.skillId)).filter(Boolean);
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-4xl">{me.avatar}</span>
        <div><h1 className="font-serif text-2xl font-bold">{me.name}</h1><p className="text-sm text-zinc-500">{me.dept}</p></div>
      </div>
      <h2 className="font-semibold mb-2">Your skills ({mine.length})</h2>
      {mine.length ? <div className="grid sm:grid-cols-2 gap-3 mb-6">{mine.map(s => <SkillCard key={s.id} skill={s} db={db} go={go} />)}</div> : <p className="text-sm text-zinc-400 mb-6">No skills yet — hit Submit to share one.</p>}
      <h2 className="font-semibold mb-2">Skills you copied ({copied.length})</h2>
      {copied.length ? <div className="grid sm:grid-cols-2 gap-3">{copied.map(s => <SkillCard key={s.id} skill={s} db={db} go={go} />)}</div> : <p className="text-sm text-zinc-400">Nothing copied yet.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin                                                              */
/* ------------------------------------------------------------------ */
function AdminView({ db, eligible, onRunAuto, onSetNote, onSend, me, go }) {
  const features = [...db.features].sort((a, b) => b.selectedAt - a.selectedAt);
  const [noteDraft, setNoteDraft] = useState({});
  const [emailFor, setEmailFor] = useState(null);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><Shield size={20} /> Admin · Featured engine</h1>

      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Automatic selection</h2>
            <p className="text-sm text-zinc-500">Picks the top eligible skill by hidden score (copies×5 + comments×3 + unique commenters×2 + upvotes×2). Skips anything featured in the last 12 months; needs ≥{MIN_DISTINCT_COPIERS} distinct copiers.</p>
          </div>
          <button onClick={onRunAuto} className="bg-zinc-900 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-zinc-800 whitespace-nowrap">Run selection</button>
        </div>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400 mb-2">Eligible ranking (score hidden from users)</p>
          {eligible.length ? (
            <div className="space-y-1">
              {eligible.slice(0, 5).map((e, i) => (
                <div key={e.s.id} className="flex items-center gap-3 text-sm py-1">
                  <span className={`w-5 text-center font-bold ${i === 0 ? "text-orange-600" : "text-zinc-300"}`}>{i + 1}</span>
                  <button onClick={() => go(e.s.id)} className="flex-1 text-left hover:underline">{e.s.title}</button>
                  <span className="text-xs text-zinc-400">{e.agg.copies}c · {e.agg.comments}💬 · {e.agg.upvotes}▲</span>
                  <span className="font-mono text-xs bg-zinc-100 rounded px-1.5 py-0.5">{e.sc}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-zinc-400">No eligible skills right now.</p>}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h2 className="font-semibold mb-3">Feature history &amp; email workflow</h2>
        {features.length === 0 && <p className="text-sm text-zinc-400">No features yet. Run selection above, or hit "Feature" on any skill's page.</p>}
        <div className="space-y-3">
          {features.map(f => {
            const skill = db.skills.find(s => s.id === f.skillId);
            if (!skill) return null;
            const agg = aggregate(skill, db);
            const isAuthor = skill.authorId === me.id;
            const statusColor = f.status === "sent" ? "text-green-600" : f.status === "ready" ? "text-blue-600" : "text-amber-600";
            return (
              <div key={f.id} className="border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <button onClick={() => go(skill.id)} className="font-semibold hover:underline">{skill.title}</button>
                    <span className="ml-2 text-xs text-zinc-400">{f.type} · {f.period}</span>
                  </div>
                  <span className={`text-xs font-medium ${statusColor}`}>
                    {f.status === "pending_note" ? "awaiting creator note" : f.status === "ready" ? "ready to send" : "sent ✓"}
                  </span>
                </div>

                {/* creator note step */}
                {f.status === "pending_note" && (
                  isAuthor ? (
                    <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-orange-800 mb-1.5">🎉 Your skill is being featured — add a note before it ships</p>
                      <textarea rows={2} value={noteDraft[f.id] || ""} onChange={e => setNoteDraft({ ...noteDraft, [f.id]: e.target.value })}
                        placeholder="What would you tell a colleague about this skill?"
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm" />
                      <button onClick={() => onSetNote(f.id, noteDraft[f.id] || "")} className="mt-2 bg-orange-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium">Add note</button>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 mt-2">Waiting on {skill.authorName} to add their note (you can send without it).</p>
                  )
                )}

                {f.creatorNote && <div className="mt-2 text-sm text-zinc-600 border-l-2 border-orange-300 pl-2 italic">"{f.creatorNote}"</div>}

                {f.status !== "sent" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setEmailFor(f.id)} className="inline-flex items-center gap-1.5 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-50"><Mail size={14} /> Preview email</button>
                    <button onClick={() => onSend(f.id)} className="inline-flex items-center gap-1.5 bg-orange-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-orange-700"><Send size={14} /> Send to org</button>
                  </div>
                )}
                {f.status === "sent" && <p className="text-xs text-zinc-400 mt-2">Sent {fmtDate(f.sentAt)} · live on Home</p>}

                {/* email preview modal */}
                {emailFor === f.id && (
                  <EmailPreview skill={skill} agg={agg} note={f.creatorNote} onClose={() => setEmailFor(null)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ skill, agg, note, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 bg-zinc-50">
          <span className="text-sm font-medium text-zinc-500">Email preview — org-wide</span>
          <button onClick={onClose}><X size={18} className="text-zinc-400" /></button>
        </div>
        <div className="p-6">
          <div className="text-xs text-zinc-400 mb-1">Subject</div>
          <p className="font-semibold mb-4">🔥 Skill of the Month: {skill.title}</p>
          <div className="border border-zinc-200 rounded-xl p-5">
            <div className="text-orange-600 text-xs font-semibold uppercase tracking-wider mb-1">Skill of the Month</div>
            <h2 className="font-serif text-xl font-bold">{skill.title}</h2>
            <p className="text-sm text-zinc-600 mt-1">{skill.description}</p>
            {note && <div className="mt-3 border-l-2 border-orange-400 pl-3 text-sm italic text-zinc-700">What {skill.authorName} says: "{note}"</div>}
            <div className="flex gap-4 mt-4 text-sm text-zinc-500">
              <span>⧉ {agg.copies} copies</span><span>💬 {agg.comments} comments</span><span>▲ {agg.upvotes} upvotes</span>
            </div>
            <div className="mt-4 inline-block bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-semibold">View &amp; Copy →</div>
          </div>
          <p className="text-[11px] text-zinc-400 mt-3 text-center">In production this sends via your org mail provider. Here it's a preview.</p>
        </div>
      </div>
    </div>
  );
}
