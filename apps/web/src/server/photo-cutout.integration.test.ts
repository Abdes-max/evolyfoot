import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicAccount } from "./auth";
import { createCutoutHandler } from "./photo-cutout";
import { resetRateLimits } from "./rate-limit";

const account = { id: "coach-1" } as PublicAccount;
const jpeg = `data:image/jpeg;base64,${Buffer.from("photo").toString("base64")}`;

function post(body: unknown): Request {
  return new Request("http://localhost/api/photos/detourage", { method: "POST", body: JSON.stringify(body) });
}

describe("createCutoutHandler", () => {
  beforeEach(resetRateLimits);

  it("demande une session", async () => {
    const handler = createCutoutHandler(async () => null, vi.fn(), vi.fn());
    expect((await handler(post({ image: jpeg }))).status).toBe(401);
  });

  it("refuse ce qui n’est pas une image", async () => {
    const cutout = vi.fn();
    const handler = createCutoutHandler(async () => account, cutout, vi.fn());
    expect((await handler(post({ image: "data:text/plain;base64,AAAA" }))).status).toBe(400);
    expect(cutout).not.toHaveBeenCalled();
  });

  it("renvoie la photo détourée en PNG", async () => {
    const cutout = vi.fn(async () => Buffer.from("png"));
    const handler = createCutoutHandler(async () => account, cutout, vi.fn());
    const response = await handler(post({ image: jpeg }));
    expect(await response.json()).toEqual({ image: `data:image/png;base64,${Buffer.from("png").toString("base64")}` });
    expect(cutout).toHaveBeenCalledWith(Buffer.from("photo"), "image/jpeg");
  });

  it("limite le nombre de détourages par compte", async () => {
    const handler = createCutoutHandler(
      async () => account,
      async () => Buffer.from("png"),
      vi.fn(),
    );
    for (let index = 0; index < 30; index += 1) {
      expect((await handler(post({ image: jpeg }))).status).toBe(200);
    }
    expect((await handler(post({ image: jpeg }))).status).toBe(429);
  });

  it("refuse quand le serveur détoure déjà plusieurs photos", async () => {
    let release: () => void = () => undefined;
    const slow = () => new Promise<Buffer>((resolve) => (release = () => resolve(Buffer.from("png"))));
    const handler = createCutoutHandler(async () => account, slow, vi.fn());
    const first = handler(post({ image: jpeg }));
    const firstRelease = await new Promise<() => void>((resolve) => setTimeout(() => resolve(release), 0));
    const second = handler(post({ image: jpeg }));
    const secondRelease = await new Promise<() => void>((resolve) => setTimeout(() => resolve(release), 0));
    expect((await handler(post({ image: jpeg }))).status).toBe(503);
    firstRelease();
    secondRelease();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
  });
});
