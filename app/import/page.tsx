import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ImportClient from "./ImportClient";

export const metadata = { title: "Bulk Import Skills — SkillHub" };

export default async function ImportPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  return <ImportClient />;
}
