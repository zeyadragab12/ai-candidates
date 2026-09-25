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

const ADMIN_LINK = { href: "/admin", label: "Admin" };

// Only decides whether to show the Admin link; /admin itself and every admin
// API re-check the role server-side. Cached per page load so client-side
// navigation doesn't re-query on every page.
let isAdminPromise: Promise<boolean> | null = null;

function fetchIsAdmin(): Promise<boolean> {
  isAdminPromise ??= Promise.resolve(createClient().rpc("is_admin")).then(
    ({ data, error }) => !error && data === true,
    () => false,
  );
  return isAdminPromise;
}

export function DashboardNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIsAdmin().then((result) => {
      if (!cancelled) setIsAdmin(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

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
