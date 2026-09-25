"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/candidates", label: "Candidates" },
  { href: "/settings", label: "Settings" },
];

const TEAM_LINK = { href: "/manager", label: "Team" };
const ADMIN_LINK = { href: "/admin", label: "Admin" };

// Only decides which role links to show; /manager, /admin and their APIs
// re-check the role server-side. Cached per page load so client-side
// navigation doesn't re-query on every page.
let rolePromise: Promise<string | null> | null = null;

function fetchRole(): Promise<string | null> {
  rolePromise ??= Promise.resolve(createClient().rpc("current_profile_role")).then(
    ({ data, error }) => (!error && typeof data === "string" ? data : null),
    () => null,
  );
  return rolePromise;
}

export function DashboardNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRole().then((result) => {
      if (!cancelled) setRole(result);
    });
    return () => {
      cancelled = true;
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
        <LogoutButton />
      </div>
    </header>
  );
}
