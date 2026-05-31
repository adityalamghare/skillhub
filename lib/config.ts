/**
 * Admin-tunable config.
 * Priority: DB Config table → env var → hardcoded default.
 * DB values are set via the admin console and cached per-request (no TTL needed
 * since these change rarely and the admin UI always revalidates).
 */
import { prisma } from "@/lib/prisma";

export const CONFIG_KEYS = [
  "SCORE_WEIGHT_COPIES",
  "SCORE_WEIGHT_COMMENTS",
  "SCORE_WEIGHT_UNIQUE_COMMENTERS",
  "SCORE_WEIGHT_UPVOTES",
  "SCORE_MIN_COPIERS",
  "FEATURED_SCORE_WINDOW",
  "FEATURED_RECIPIENT_LIST",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

const DEFAULTS: Record<ConfigKey, string> = {
  SCORE_WEIGHT_COPIES:            "5",
  SCORE_WEIGHT_COMMENTS:          "3",
  SCORE_WEIGHT_UNIQUE_COMMENTERS: "2",
  SCORE_WEIGHT_UPVOTES:           "2",
  SCORE_MIN_COPIERS:              "5",
  FEATURED_SCORE_WINDOW:          "monthly",
  FEATURED_RECIPIENT_LIST:        "", // group/distribution emails added on top of subscribed users
};

export async function getConfig(): Promise<Record<ConfigKey, string>> {
  const rows = await prisma.config.findMany();
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const result = {} as Record<ConfigKey, string>;
  for (const key of CONFIG_KEYS) {
    result[key] =
      dbMap[key] ??            // DB value first
      process.env[key] ??      // then env var
      DEFAULTS[key];           // then hardcoded default
  }
  return result;
}

export async function setConfigValue(key: ConfigKey, value: string) {
  await prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
