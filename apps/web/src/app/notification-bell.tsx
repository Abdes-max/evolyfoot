"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  notifications: NotificationItem[];
  unreadCount: number;
  unreadMessages: number;
}

const refreshMs = 60_000;
const emptyFeed: NotificationFeed = { notifications: [], unreadCount: 0, unreadMessages: 0 };

// Lit les notifications du compte connecté et les relit chaque minute et au retour sur l'onglet.
export function useNotifications(): [NotificationFeed, () => Promise<void>] {
  const [feed, setFeed] = useState<NotificationFeed>(emptyFeed);
  const reload = useCallback(async () => {
    const response = await fetch("/api/notifications").catch(() => null);
    const body = response?.ok ? await response.json().catch(() => null) : null;
    if (body) setFeed(body);
  }, []);

  useEffect(() => {
    const first = setTimeout(reload, 0);
    const timer = setInterval(reload, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return [feed, reload];
}

export function UnreadBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span aria-label={`${count} ${label}`} className="unread-badge">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Cloche : compteur des non lus, liste des dernières alertes, « tout marquer lu ».
export function NotificationBell() {
  const [feed, reload] = useNotifications();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function markRead(body: { all: true } | { ids: string[] }) {
    await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    await reload();
  }

  return (
    <div className="notification-bell" ref={panel}>
      <button
        aria-expanded={open}
        aria-label={`Notifications${feed.unreadCount > 0 ? `, ${feed.unreadCount} non lues` : ""}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        <UnreadBadge count={feed.unreadCount} label="non lues" />
      </button>
      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-head">
            <strong>Notifications</strong>
            {feed.unreadCount > 0 && (
              <button className="text-button" onClick={() => markRead({ all: true })} type="button">
                Tout marquer lu
              </button>
            )}
          </div>
          {feed.notifications.length === 0 ? (
            <p className="notification-empty">Rien de nouveau pour l’instant.</p>
          ) : (
            <ul>
              {feed.notifications.map((notification) => (
                <li className={notification.read ? undefined : "unread"} key={notification.id}>
                  <Link
                    // Anciennes alertes de message (/equipe/:id) : la messagerie, pas la fiche joueur.
                    href={notification.kind === "message" ? notification.link.replace(/^\/equipe\/([^/?#]+)$/, "/messagerie?joueur=$1") : notification.link}
                    onClick={() => {
                      setOpen(false);
                      if (!notification.read) void markRead({ ids: [notification.id] });
                    }}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <small>{ago(notification.createdAt)}</small>
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
