import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

describe("NotificationBell", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("affiche le nombre de non lus, la liste et marque tout lu", async () => {
    let unread = 2;
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/notifications/read") {
          posted.push(JSON.parse(init!.body as string));
          unread = 0;
          return new Response(null, { status: 204 });
        }
        return Response.json({
          unreadCount: unread,
          unreadMessages: unread,
          notifications: [
            {
              id: "n-1",
              kind: "message",
              title: "Message de Lina",
              body: "Je serai en retard.",
              link: "/equipe/p-1",
              read: unread === 0,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }),
    );

    render(<NotificationBell />);

    const bell = await screen.findByRole("button", { name: "Notifications, 2 non lues" });
    fireEvent.click(bell);
    expect(screen.getByRole("link", { name: /Message de Lina/ })).toHaveAttribute("href", "/messagerie?joueur=p-1");

    fireEvent.click(screen.getByRole("button", { name: "Tout marquer lu" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible());
    expect(posted).toEqual([{ all: true }]);
  });
});
