import { describe, expect, it, vi } from "vitest";
import { createSearchPlacesHandler, searchPlaces } from "./places";

const educator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const request = (query: string) => new Request(`https://evolyfoot.test/api/places?q=${encodeURIComponent(query)}`);

describe("searchPlaces", () => {
  it("compose une ligne lisible et retire les doublons", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        features: [
          { properties: { name: "Stade Marius Requier", street: "Avenue Ampère", postcode: "13100", city: "Aix-en-Provence" } },
          { properties: { name: "Stade Marius Requier", street: "Avenue Ampère", postcode: "13100", city: "Aix-en-Provence" } },
          { properties: { housenumber: "12", street: "Rue Victor Hugo", postcode: "75011", city: "Paris" } },
        ],
      }),
    ) as unknown as typeof fetch;

    expect(await searchPlaces("stade", fetcher)).toEqual([
      "Stade Marius Requier, Avenue Ampère, 13100 Aix-en-Provence",
      "12 Rue Victor Hugo, 75011 Paris",
    ]);
  });

  it("ne renvoie rien si le service répond en erreur", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;

    expect(await searchPlaces("stade", fetcher)).toEqual([]);
  });
});

describe("createSearchPlacesHandler", () => {
  it("exige une session d'éducateur", async () => {
    const search = vi.fn();
    const response = await createSearchPlacesHandler(async () => null, search, () => undefined)(request("stade"));

    expect(response.status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it("ne cherche pas en dessous de trois caractères", async () => {
    const search = vi.fn();
    const response = await createSearchPlacesHandler(authenticated, search, () => undefined)(request("st"));

    expect(await response.json()).toEqual({ places: [] });
    expect(search).not.toHaveBeenCalled();
  });

  it("laisse la saisie libre si le service est indisponible", async () => {
    const log = vi.fn();
    const search = vi.fn(async () => {
      throw new Error("indisponible");
    });
    const response = await createSearchPlacesHandler(authenticated, search, log)(request("stade"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ places: [] });
    expect(log).toHaveBeenCalledOnce();
  });
});
