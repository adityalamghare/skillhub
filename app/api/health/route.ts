import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // DEMO BREAK — runtime error to simulate a bad deploy
  throw new Error("Simulated error: database connection pool exhausted");
}
