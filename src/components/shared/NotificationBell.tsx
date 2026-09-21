"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, AtSign, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUIStore } from "@/stores/ui.store";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "@/server/actions/notification.actions";

function timeAgoSafe(date: string | Date): string {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { setOpenTicketId } = useUIStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const result = await getNotifications({ limit: 30 });
    if (result.success) {
      setItems(result.data.items);
      setUnreadCount(result.data.unreadCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) fetchData();
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      const res = await markNotificationRead({ notificationId: item.id });
      if (!res.success) fetchData(); // roll back to server truth on failure
    }
    if (!item.ticketId) {
      setOpen(false);
      return;
    }
    // Deep link: resolve the ticket's board, then open the panel there
    setNavigatingId(item.id);
    try {
      const res = await fetch(`/api/tickets/${item.ticketId}`);
      if (res.ok) {
        const ticket = await res.json();
        setOpen(false);
        setOpenTicketId(item.ticketId);
        router.push(`/board/${ticket.boardId}?ticket=${item.ticketId}`);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setOpen(false);
      router.refresh();
    } finally {
      setNavigatingId(null);
    }
  };

  const handleMarkAll = async () => {
    const prev = items;
    const prevCount = unreadCount;
    setItems((prevItems) => prevItems.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    const res = await markAllNotificationsRead();
    if (!res.success) {
      setItems(prev);
      setUnreadCount(prevCount);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => handleOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-surface-base">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[360px] max-w-[90vw] bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <p className="text-[13px] font-bold text-foreground">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-10 px-6 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center text-muted-foreground mb-3">
                  <Bell size={18} />
                </div>
                <p className="text-[13px] font-medium text-foreground">All caught up</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  When someone @mentions you in a comment, it will show up here.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-3 border-b border-surface-border last:border-0 hover:bg-surface-base transition-colors flex gap-3 ${
                    !item.isRead ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                    style={{ background: item.actor?.avatarColor ?? "#5B5FEF" }}
                  >
                    {item.type === "MENTION" ? (
                      <AtSign size={14} />
                    ) : (
                      (item.actor?.displayName ?? "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-foreground leading-snug">
                      {item.title}
                      {!item.isRead && (
                        <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                      )}
                    </p>
                    {item.body && (
                      <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    )}
                    <p className="text-[10.5px] text-muted-foreground/70 font-mono mt-1">
                      {timeAgoSafe(item.createdAt)}
                    </p>
                  </div>
                  {navigatingId === item.id && (
                    <Loader2 size={14} className="animate-spin text-primary flex-shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
