import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getProfile, type Profile } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

/**
 * The gate every API route passes first: a signed-in user whose profile is
 * active. Deactivating someone in the Admin dashboard therefore cuts off
 * every API immediately, not just the admin/manager ones.
 */
export async function requireUser(): Promise<
  | { user: User; supabase: Awaited<ReturnType<typeof createClient>>; profile: Profile }
  | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile || !profile.is_active) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, supabase, profile };
}
