import { ValidationError } from "@evolyfoot/database";
import type { PersonalExercise } from "@evolyfoot/domain";
import { describe, expect, it, vi } from "vitest";
import type { PublicEducator } from "./auth";
import { createAddPersonalExerciseHandler, createListPersonalExercisesHandler, createRemovePersonalExerciseHandler } from "./personal-exercise";

const educator: PublicEducator = { id: "educator-1", email: "coach@example.test", displayName: "Coach" };
const authenticated = async () => educator;
const anonymous = async () => null;
const exercise: PersonalExercise = {
  id: "exercise-1",
  kind: "main",
  theme: "Conserver le ballon",
  title: "Mon rondo",
  objective: "",
  organization: "",
  instruction: "",
  observable: "",
  photo: null,
};
const request = (body?: unknown) => new Request("http://localhost/api/personal-exercises", { method: "POST", body: JSON.stringify(body ?? {}) });

describe("exercices personnels", () => {
  it("exige une session sur chaque route", async () => {
    expect((await createListPersonalExercisesHandler(anonymous, { list: vi.fn() }, vi.fn())(request())).status).toBe(401);
    expect((await createAddPersonalExerciseHandler(anonymous, { add: vi.fn() }, vi.fn())(request(exercise))).status).toBe(401);
    expect((await createRemovePersonalExerciseHandler(anonymous, { remove: vi.fn() }, vi.fn())(request(), "x")).status).toBe(401);
  });

  it("refuse une fiche mal formée", async () => {
    const add = vi.fn();

    expect((await createAddPersonalExerciseHandler(authenticated, { add }, vi.fn())(request({ title: "Seul" }))).status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });

  it("ajoute au compte connecté et remonte les erreurs de validation", async () => {
    const add = vi.fn(async () => exercise);
    const refused = createAddPersonalExerciseHandler(authenticated, { add: async () => { throw new ValidationError("Limite."); } }, vi.fn());

    expect((await createAddPersonalExerciseHandler(authenticated, { add }, vi.fn())(request(exercise))).status).toBe(201);
    expect(add.mock.calls[0]?.[0 as never]).toBe("educator-1");
    expect((await refused(request(exercise))).status).toBe(400);
  });

  it("retire un exercice pour le compte connecté", async () => {
    const remove = vi.fn(async () => undefined);

    expect((await createRemovePersonalExerciseHandler(authenticated, { remove }, vi.fn())(request(), "exercise-1")).status).toBe(204);
    expect(remove).toHaveBeenCalledWith("educator-1", "exercise-1");
  });
});
