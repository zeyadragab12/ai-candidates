import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { withErrorHandling } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("login") }),
  z.object({ event: z.literal("logout") }),
  z.object({ event: z.literal("login_failed"), email: z.string().trim().email().max(320) }),
]);

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Records sign-in / sign-out / failed sign-in in the activity log. Password
 * sign-in happens in the browser, so the login page reports the outcome
 * here. Success and logout are only ever recorded for the session's own
 * user; a failed attempt has no session, so it goes through the
 * record_failed_login() DB function, which only logs known accounts and
 * caps entries per account. The IP rate limit below adds a second cap.
 */
export const POST = withErrorHandling(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auth event." }, { status: 400 });
  }

  const supabase = await createClient();

  if (parsed.data.event === "login_failed") {
    await enforceRateLimit(`auth-failed:${clientIp(request)}`, 10, 60);
    if (isEmailAllowed(parsed.data.email)) {
      await supabase.rpc("record_failed_login", { p_email: parsed.data.email });
    }
    return NextResponse.json({ ok: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await logActivity(supabase, {
    userId: user.id,
    action: parsed.data.event === "login" ? "auth.login" : "auth.logout",
    entityType: "auth",
    entityId: user.id,
    description: parsed.data.event === "login" ? "Signed in" : "Signed out",
    metadata: { method: parsed.data.event === "login" ? "password" : undefined },
  });

  return NextResponse.json({ ok: true });
});
