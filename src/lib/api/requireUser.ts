import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(): Promise<
  { user: User; supabase: Awaited<ReturnType<typeof createClient>> } | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, supabase };
}
