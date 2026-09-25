import { NextResponse } from "next/server";

/**
 * Managers and admins can read their team's / everyone's records, but
 * writes stay owner-only (RLS enforces that too). Checking up front turns a
 * write that would fail deep inside a handler — often after paid search or
 * AI calls — into an immediate, clear 403.
 */
export function forbidUnlessOwner(
  ownerId: string | null | undefined,
  userId: string,
  what: string,
): NextResponse | null {
  if (ownerId === userId) return null;
  return NextResponse.json(
    { error: `You can view this ${what}, but only its owner can change it.` },
    { status: 403 },
  );
}
