import { NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/log";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  await logActivity(supabase, {
    userId: data.user.id,
    action: "auth.login",
    entityType: "auth",
    entityId: data.user.id,
    description: "Signed in with Google",
    metadata: { method: "google" },
  });

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
