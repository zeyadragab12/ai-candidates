"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/candidates", label: "Candidates" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

const TEAM_LINK = { href: "/manager", label: "Team" };
const ADMIN_LINK = { href: "/admin", label: "Admin" };

// Only decides which role links to show; /manager, /admin and their APIs
// re-check the role server-side. Cached per signed-in user so client-side
// navigation doesn't re-query on every page, while a sign-in, sign-out or
// account switch in the same tab gets a fresh answer. An empty answer is
// never cached: right after login the lookup can run before the session is
// attached, and caching that would hide the links until a full reload.
const roleCache = new Map<string, Promise<string | null>>();

async function fetchRole(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) return null;

  let pending = roleCache.get(userId);
  if (!pending) {
    pending = Promise.resolve(supabase.rpc("current_profile_role")).then(
      ({ data, error }) => (!error && typeof data === "string" ? data : null),
      () => null,
    );
    roleCache.set(userId, pending);
    void pending.then((role) => {
      if (role === null) roleCache.delete(userId);
    });
  }
  return pending;
}

export function DashboardNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchRole().then((result) => {
        if (!cancelled) setRole(result);
      });

    // Fires once immediately (INITIAL_SESSION) and again on sign-in/out and
    // token refresh. Deferred because supabase-js warns against awaiting
    // its own calls inside this callback.
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange(() => {
      setTimeout(load, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const links =
    role === "admin"
      ? [...LINKS, TEAM_LINK, ADMIN_LINK]
      : role === "hr_manager"
        ? [...LINKS, TEAM_LINK]
        : LINKS;

  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/dashboard" className="flex items-center">
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              AI Candidate
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === link.href
                  : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {(role === "hr_manager" || role === "admin") && <NotificationBell />}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
