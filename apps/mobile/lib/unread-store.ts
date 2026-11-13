import { useEffect, useState } from "react";

// Compteurs « non lus » partagés par tous les écrans (barre d'onglets, cloche, accueil) : une relecture
// met à jour toutes les pastilles à la fois.
export interface UnreadCounts {
  unreadCount: number;
  unreadMessages: number;
  // Joueurs dont un tuteur attend une réponse du coach.
  pendingTutorPlayerIds: string[];
}

let current: UnreadCounts = { unreadCount: 0, unreadMessages: 0, pendingTutorPlayerIds: [] };
const listeners = new Set<(counts: UnreadCounts) => void>();
// Plusieurs pastilles affichées en même temps : une seule relecture toutes les quelques secondes.
let lastRead = 0;

function readSoon(sessionToken: string, read: (sessionToken: string) => Promise<UnreadCounts | null>): void {
  if (Date.now() - lastRead < 5_000) return;
  lastRead = Date.now();
  void read(sessionToken);
}

export function publishUnread(counts: UnreadCounts): void {
  current = counts;
  listeners.forEach((listener) => listener(counts));
}

// Relit les compteurs à l'affichage puis toutes les 30 secondes : un message reçu appli ouverte
// s'affiche sans changer d'écran.
export function useUnreadCounts(sessionToken: string | null, read: (sessionToken: string) => Promise<UnreadCounts | null>): UnreadCounts {
  const [counts, setCounts] = useState(current);
  useEffect(() => {
    listeners.add(setCounts);
    setCounts(current);
    if (!sessionToken) return () => void listeners.delete(setCounts);
    readSoon(sessionToken, read);
    const timer = setInterval(() => readSoon(sessionToken, read), 30_000);
    return () => {
      clearInterval(timer);
      listeners.delete(setCounts);
    };
  }, [sessionToken, read]);
  return counts;
}
