import { beforeEach, describe, expect, it } from "vitest";
import { DuplicateEducatorEmailError, ValidationError } from "./errors";
import { InviteInvalidError } from "./player-invite-service";
import { hashSessionToken } from "./session-token";
import { maxStaffMembers, StaffService } from "./staff-service";
import type { EducatorRecord, EducatorRepository, StaffInviteRecord, StaffMember, StaffRepository, TeamRepository } from "./repositories";

const now = new Date("2026-11-01T12:00:00.000Z");

class FakeStaffRepository implements StaffRepository {
  members: StaffMember[] = [];
  invites: StaffInviteRecord[] = [];

  async listMembers() {
    return this.members;
  }
  async createInvite(input: { educatorId: string; tokenHash: string; expiresAt: Date }) {
    this.invites.push({ id: `i${this.invites.length}`, consumedAt: null, ...input });
  }
  async findInviteByTokenHash(tokenHash: string) {
    return this.invites.find((invite) => invite.tokenHash === tokenHash) ?? null;
  }
  async consumeInvite(id: string) {
    const invite = this.invites.find((candidate) => candidate.id === id);
    if (!invite || invite.consumedAt) {
      return false;
    }
    invite.consumedAt = now;
    return true;
  }
  async removeMember(ownerId: string, memberId: string) {
    const before = this.members.length;
    this.members = this.members.filter((member) => member.id !== memberId);
    return ownerId === "owner" && this.members.length < before;
  }
}

function setup() {
  const staff = new FakeStaffRepository();
  const created: Array<Record<string, unknown>> = [];
  const taken = new Set(["pris@example.test"]);
  const educators = {
    findById: async () => ({ id: "owner", displayName: "Coach" }) as EducatorRecord,
    findByEmail: async (email: string) => (taken.has(email) ? ({ id: "x" } as never) : null),
    create: async (input: Record<string, unknown>) => {
      created.push(input);
      return { id: "adjoint", ...input } as unknown as EducatorRecord;
    },
  } as unknown as EducatorRepository;
  const teams = { findForEducator: async () => ({ profile: { name: "FC Horizon" } }) } as unknown as TeamRepository;
  const auth = { openSession: async (educator: EducatorRecord) => ({ educator, sessionToken: "jeton", expiresAt: now }) };
  return { staff, created, service: new StaffService(educators, staff, teams, auth, () => now) };
}

const input = { email: "adjoint@example.test", password: "mot-de-passe-long", displayName: "Adjoint" };

describe("StaffService", () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it("stocke uniquement l'empreinte du jeton d'invitation", async () => {
    const { token } = await context.service.invite("owner");

    expect(context.staff.invites[0]?.tokenHash).toBe(hashSessionToken(token));
    expect(context.staff.invites[0]?.tokenHash).not.toBe(token);
  });

  it("présente l'équipe et rattache le nouveau compte à l'éducateur", async () => {
    const { token } = await context.service.invite("owner");

    await expect(context.service.preview(token)).resolves.toEqual({ coachName: "Coach", teamName: "FC Horizon" });
    await context.service.join(token, input);

    expect(context.created[0]).toMatchObject({ role: "assistant", ownerEducatorId: "owner", email: "adjoint@example.test" });
  });

  it("n'accepte un lien qu'une seule fois", async () => {
    const { token } = await context.service.invite("owner");
    await context.service.join(token, input);

    await expect(context.service.join(token, { ...input, email: "autre@example.test" })).rejects.toBeInstanceOf(InviteInvalidError);
    expect(context.created).toHaveLength(1);
  });

  it("garde le lien utilisable si l'adresse est déjà prise", async () => {
    const { token } = await context.service.invite("owner");

    await expect(context.service.join(token, { ...input, email: "pris@example.test" })).rejects.toBeInstanceOf(DuplicateEducatorEmailError);
    await expect(context.service.join(token, input)).resolves.toMatchObject({ sessionToken: "jeton" });
  });

  it("refuse un lien expiré ou inconnu", async () => {
    const { token } = await context.service.invite("owner");
    context.staff.invites[0]!.expiresAt = new Date(now.getTime() - 1);

    await expect(context.service.join(token, input)).rejects.toBeInstanceOf(InviteInvalidError);
    await expect(context.service.preview("inconnu")).rejects.toBeInstanceOf(InviteInvalidError);
  });

  it("limite le nombre d'adjoints", async () => {
    context.staff.members = Array.from({ length: maxStaffMembers }, (_, index) => ({ id: `m${index}`, displayName: "A", email: "a@b.c", createdAt: now }));

    await expect(context.service.invite("owner")).rejects.toBeInstanceOf(ValidationError);
  });
});
