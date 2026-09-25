"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatRelativeTime } from "@/lib/dates/formatRelativeTime";
import type { NotificationItem } from "@/lib/notifications/notifications";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

async function markRead(ids?: string[]): Promise<void> {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids } : {}),
  }).catch(() => undefined);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { unread: number; items: NotificationItem[] };
      setItems(data.items);
      setUnread(data.unread);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  // Poll only while the tab is visible, and catch up as soon as it returns.
  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) refresh();
  }

  async function handleMarkAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    await markRead();
  }

  function handleOpenItem(item: NotificationItem) {
    setOpen(false);
    if (item.read) return;
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    setUnread((count) => Math.max(0, count - 1));
    void markRead([item.id]);
  }

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-indigo-700 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {loadFailed && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Notifications couldn&apos;t be loaded. Try again shortly.
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              You&apos;re all caught up. Team sourcing runs, shortlists, hires, strong matches, and
              access requests will show up here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => handleOpenItem(item)}
                    className={cn(
                      "flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50",
                      !item.read && "bg-indigo-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        item.read ? "bg-transparent" : "bg-indigo-600",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-700">
                        <span className="font-medium text-slate-900">{item.actorName}</span>{" "}
                        {item.description.charAt(0).toLowerCase() + item.description.slice(1)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {formatRelativeTime(item.createdAt)}
                        {!item.read && <span className="sr-only"> · unread</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
