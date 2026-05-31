export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string; // Tailwind bg class (earned)
}

export const BADGES: BadgeDefinition[] = [
  {
    id:          "first_skill",
    name:        "First Skill",
    description: "Published your first skill",
    emoji:       "🚀",
    color:       "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  {
    id:          "first_copy",
    name:        "First Copy",
    description: "Someone copied one of your skills",
    emoji:       "📋",
    color:       "bg-sky-100 text-sky-700 border-sky-200",
  },
  {
    id:          "ten_copies",
    name:        "10-Copies Club",
    description: "Your skills have been copied 10+ times",
    emoji:       "🔟",
    color:       "bg-teal-100 text-teal-700 border-teal-200",
  },
  {
    id:          "hundred_copies",
    name:        "100-Copies Club",
    description: "Your skills have been copied 100+ times",
    emoji:       "💯",
    color:       "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    id:          "trendsetter",
    name:        "Trendsetter",
    description: "Authored a Skill of the Month",
    emoji:       "🌟",
    color:       "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  {
    id:          "conversationalist",
    name:        "Conversationalist",
    description: "Left 5 or more comments",
    emoji:       "💬",
    color:       "bg-green-100 text-green-700 border-green-200",
  },
];

export interface BadgeStatus {
  badge: BadgeDefinition;
  earned: boolean;
}

export interface BadgeInput {
  skillCount:       number; // skills authored by this user
  nonSelfCopyCount: number; // copies received on their skills (excluding self)
  wasFeatured:      boolean; // any of their skills was ever featured
  commentCount:     number; // total comments they've written
}

export function computeBadges(input: BadgeInput): BadgeStatus[] {
  return BADGES.map((badge) => ({
    badge,
    earned:
      badge.id === "first_skill"       ? input.skillCount >= 1 :
      badge.id === "first_copy"        ? input.nonSelfCopyCount >= 1 :
      badge.id === "ten_copies"        ? input.nonSelfCopyCount >= 10 :
      badge.id === "hundred_copies"    ? input.nonSelfCopyCount >= 100 :
      badge.id === "trendsetter"       ? input.wasFeatured :
      badge.id === "conversationalist" ? input.commentCount >= 5 :
      false,
  }));
}
