import {
  Html, Head, Preview, Body, Container, Section, Heading, Text,
  Button, Hr, Link, Row, Column,
} from "@react-email/components";
import * as React from "react";

export interface FeaturedSkillEmailProps {
  skillTitle: string;
  authorName: string;
  toolType: "Claude" | "Cursor" | "Both";
  tags: string[];
  description: string;
  /** Only rendered if non-empty. */
  creatorNote?: string;
  copies: number;
  upvotes: number;
  comments: number;
  skillUrl: string;
  browseUrl: string;
  /** Defaults to the current month, e.g. "May 2026". */
  monthLabel?: string;
}

const ACCENT = "#4f46e5";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

export default function FeaturedSkillEmail({
  skillTitle,
  authorName,
  toolType,
  tags,
  description,
  creatorNote,
  copies,
  upvotes,
  comments,
  skillUrl,
  browseUrl,
  monthLabel,
}: FeaturedSkillEmailProps) {
  const hasNote = !!creatorNote && creatorNote.trim().length > 0;
  const month =
    monthLabel ||
    new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Html>
      <Head />
      <Preview>
        {`Skill of the Month: ${skillTitle} by ${authorName}`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header band */}
          <Section style={header}>
            <Text style={kicker}>SKILL OF THE MONTH · {month.toUpperCase()}</Text>
            <Heading style={brand}>SkillHub</Heading>
          </Section>

          {/* Body */}
          <Section style={content}>
            {/* Intro / context */}
            <Text style={intro}>
              This month&rsquo;s standout skill is{" "}
              <strong style={{ color: INK }}>{skillTitle}</strong>, from{" "}
              <strong style={{ color: INK }}>{authorName}</strong> — surfaced
              because the team has actually been copying and discussing it.
            </Text>

            {/* Skill card */}
            <Section style={card}>
              <Heading as="h2" style={skillTitleStyle}>
                {skillTitle}
              </Heading>
              <Text style={byline}>
                by {authorName} &nbsp;·&nbsp; {toolType}
              </Text>

              {tags?.length > 0 && (
                <Section style={{ marginBottom: "12px" }}>
                  {tags.map((t) => (
                    <span key={t} style={tag}>
                      {t}
                    </span>
                  ))}
                </Section>
              )}

              <Text style={descStyle}>{description}</Text>

              {/* Author note — only if present */}
              {hasNote && (
                <Section style={noteBox}>
                  <Text style={noteLabel}>
                    Here&rsquo;s what {authorName} has to say
                  </Text>
                  <Text style={noteText}>&ldquo;{creatorNote}&rdquo;</Text>
                </Section>
              )}

              {/* Stats */}
              <Row style={{ marginTop: "20px" }}>
                <Column style={statCol}>
                  <Text style={statNum}>{copies}</Text>
                  <Text style={statLabel}>copies</Text>
                </Column>
                <Column style={statCol}>
                  <Text style={statNum}>{upvotes}</Text>
                  <Text style={statLabel}>upvotes</Text>
                </Column>
                <Column style={statCol}>
                  <Text style={statNum}>{comments}</Text>
                  <Text style={statLabel}>comments</Text>
                </Column>
              </Row>

              <Section style={{ textAlign: "center", marginTop: "24px" }}>
                <Button style={cta} href={skillUrl}>
                  View &amp; Copy Skill →
                </Button>
              </Section>
            </Section>

            <Hr style={hr} />
            <Text style={footer}>
              You&rsquo;re receiving this because you&rsquo;re part of the team.{" "}
              <Link style={footerLink} href={browseUrl}>
                Browse all skills
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ---- styles ---- */
const body: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};
const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${LINE}`,
};
const header: React.CSSProperties = {
  backgroundColor: ACCENT,
  padding: "28px 32px",
};
const kicker: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: 0,
};
const brand: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "26px",
  fontWeight: 800,
  margin: "6px 0 0",
};
const content: React.CSSProperties = { padding: "28px 32px" };
const intro: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "24px",
  color: MUTED,
  margin: "0 0 22px",
};
const card: React.CSSProperties = {
  border: `1px solid ${LINE}`,
  borderRadius: "12px",
  padding: "22px",
};
const skillTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: INK,
  margin: "0 0 4px",
};
const byline: React.CSSProperties = {
  fontSize: "13px",
  color: MUTED,
  margin: "0 0 12px",
};
const tag: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#eef2ff",
  color: ACCENT,
  fontSize: "11px",
  fontWeight: 600,
  borderRadius: "999px",
  padding: "3px 10px",
  marginRight: "6px",
};
const descStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#334155",
  margin: "0",
};
const noteBox: React.CSSProperties = {
  borderLeft: `3px solid ${ACCENT}`,
  backgroundColor: "#f8fafc",
  borderRadius: "0 8px 8px 0",
  padding: "12px 16px",
  margin: "18px 0 0",
};
const noteLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: ACCENT,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 4px",
};
const noteText: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#334155",
  fontStyle: "italic",
  margin: 0,
};
const statCol: React.CSSProperties = { textAlign: "center" as const };
const statNum: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
  color: INK,
  margin: 0,
};
const statLabel: React.CSSProperties = {
  fontSize: "12px",
  color: MUTED,
  margin: "2px 0 0",
};
const cta: React.CSSProperties = {
  backgroundColor: ACCENT,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  borderRadius: "8px",
  padding: "12px 24px",
  textDecoration: "none",
};
const hr: React.CSSProperties = {
  borderColor: LINE,
  margin: "24px 0 16px",
};
const footer: React.CSSProperties = {
  fontSize: "12px",
  color: MUTED,
  textAlign: "center" as const,
  margin: 0,
};
const footerLink: React.CSSProperties = { color: ACCENT, fontWeight: 600 };
