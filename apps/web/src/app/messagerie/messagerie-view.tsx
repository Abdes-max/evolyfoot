"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MessagingThread } from "../messaging-thread";

interface RosterPlayer {
  id: string;
  name: string;
}

interface MessageNotification {
  kind: string;
  link: string;
  read: boolean;
}

// Un fil par joueur de l'effectif (même API que la fiche joueur). Les fils avec un message non lu
// remontent en tête, repérés par les notifications « message » qui pointent vers /equipe/:id.
export function MessagerieView() {
  const requested = useSearchParams()?.get("joueur") ?? null;
  const [players, setPlayers] = useState<RosterPlayer[] | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(requested);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [rosterResponse, notificationsResponse] = await Promise.all([fetch("/api/roster"), fetch("/api/notifications")]);
      const roster = rosterResponse.ok ? await rosterResponse.json().catch(() => null) : null;
      const feed = notificationsResponse.ok ? await notificationsResponse.json().catch(() => null) : null;
      if (!active) return;
      const unreadIds = new Set<string>(
        ((feed?.notifications ?? []) as MessageNotification[])
          .filter((notification) => notification.kind === "message" && !notification.read)
          .map((notification) => notification.link.split("/").pop() ?? ""),
      );
      const list: RosterPlayer[] = Array.isArray(roster?.players) ? roster.players : [];
      setUnread(unreadIds);
      setPlayers([...list].sort((a, b) => Number(unreadIds.has(b.id)) - Number(unreadIds.has(a.id)) || a.name.localeCompare(b.name, "fr")));
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = players?.find((player) => player.id === selectedId) ?? null;

  function open(playerId: string) {
    setSelectedId(playerId);
    setUnread((current) => {
      const next = new Set(current);
      next.delete(playerId);
      return next;
    });
  }

  return (
    <main className="messagerie-shell">
      <header className="page-header messagerie-header">
        <div>
          <span className="eyebrow light">MESSAGERIE</span>
          <h1>Tes échanges avec les joueurs et les familles.</h1>
        </div>
      </header>

      <section className="messagerie-content">
        {players === null ? (
          <p className="messaging-note">Chargement…</p>
        ) : players.length === 0 ? (
          <p className="messaging-note">
            Ajoute des joueurs à ton effectif pour échanger avec eux. <Link href="/equipe">Mon équipe</Link>
          </p>
        ) : (
          <div className={selected ? "messagerie-layout has-thread" : "messagerie-layout"}>
            <ul className="messagerie-players" aria-label="Conversations">
              {players.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    className={player.id === selectedId ? "messagerie-player active" : "messagerie-player"}
                    aria-current={player.id === selectedId ? "true" : undefined}
                    onClick={() => open(player.id)}
                  >
                    <span>{player.name}</span>
                    {unread.has(player.id) ? <span className="messagerie-unread">Nouveau</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="messagerie-thread">
              {selected ? (
                <>
                  <div className="messagerie-thread-head">
                    <button type="button" className="messagerie-back" onClick={() => setSelectedId(null)}>
                      ← Conversations
                    </button>
                    <h2>{selected.name}</h2>
                    <Link href={`/equipe/${selected.id}`}>Voir la fiche</Link>
                  </div>
                  <MessagingThread
                    key={selected.id}
                    fetchUrl={`/api/roster/${selected.id}/messages`}
                    sendUrl={`/api/roster/${selected.id}/messages`}
                    viewerRole="coach"
                  />
                </>
              ) : (
                <p className="messaging-note">Choisis un joueur pour ouvrir la conversation.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
