import { randomUUID } from "node:crypto";
import { TeamSpaceNotFoundError, ValidationError } from "./errors";
import { hashPassword } from "./password";
import type { EducatorRecord, EducatorRepository, SessionRepository, TeamRepository, TeamSpaceRepository } from "./repositories";
import { generateSessionToken, hashSessionToken } from "./session-token";

// Compte connecté qui gère ses équipes : l'éducateur lui-même, jamais un espace d'équipe.
export type TeamOwner = Pick<EducatorRecord, "id" | "displayName" | "role">;

// Première équipe comprise.
export const maxTeamsPerEducator = 10;

export interface TeamChoice {
  // Identifiant du compte qui porte l'équipe : l'éducateur pour sa première équipe, l'espace sinon.
  id: string;
  name: string | null;
  ageGroup: string | null;
  primary: boolean;
  active: boolean;
}

// Plusieurs équipes par éducateur : chaque équipe supplémentaire vit dans un espace d'équipe, un
// compte "team" rattaché à l'éducateur, sans connexion possible. Son effectif, ses séances, ses
// matchs et son staff restent ceux de cet espace ; la session retient l'équipe choisie et
// AuthService.getEducatorForSession renvoie l'espace correspondant.
export class TeamSpaceService {
  constructor(
    private readonly educatorRepository: EducatorRepository,
    private readonly teamSpaceRepository: TeamSpaceRepository,
    private readonly teamRepository: TeamRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async list(account: TeamOwner, sessionToken: string): Promise<TeamChoice[]> {
    const [spaces, activeId] = await Promise.all([this.teamSpaceRepository.listForOwner(account.id), this.activeTeamId(account, sessionToken)]);
    return Promise.all(
      [account, ...spaces].map(async (owner) => {
        const team = await this.teamRepository.findForEducator(owner.id);
        return {
          id: owner.id,
          name: team?.profile.name ?? null,
          ageGroup: team?.profile.ageGroup ?? null,
          primary: owner.id === account.id,
          active: owner.id === activeId,
        };
      }),
    );
  }

  // Crée l'espace et le rend actif : l'éducateur enchaîne sur la configuration de l'équipe.
  async create(account: TeamOwner, sessionToken: string): Promise<{ id: string }> {
    this.requireCoach(account);
    const spaces = await this.teamSpaceRepository.listForOwner(account.id);
    if (spaces.length + 1 >= maxTeamsPerEducator) {
      throw new ValidationError(`Tu gères déjà ${maxTeamsPerEducator} équipes.`);
    }
    const space = await this.educatorRepository.create({
      email: `equipe-${randomUUID()}@equipes.evolyfoot.invalid`,
      displayName: account.displayName,
      passwordHash: await hashPassword(generateSessionToken()),
      role: "team",
      ownerEducatorId: account.id,
    });
    await this.sessionRepository.setActiveTeam(hashSessionToken(sessionToken), space.id);
    return { id: space.id };
  }

  async activate(account: TeamOwner, sessionToken: string, teamId: string): Promise<void> {
    this.requireCoach(account);
    if (teamId !== account.id && !(await this.ownsSpace(account, teamId))) {
      throw new TeamSpaceNotFoundError();
    }
    await this.sessionRepository.setActiveTeam(hashSessionToken(sessionToken), teamId === account.id ? null : teamId);
  }

  // Supprime une équipe supplémentaire et tout ce qui s'y rattache. La première équipe ne se
  // supprime pas ici : elle part avec le compte.
  async remove(account: TeamOwner, sessionToken: string, teamId: string): Promise<void> {
    this.requireCoach(account);
    if (teamId === account.id) {
      throw new ValidationError("Ta première équipe ne peut pas être supprimée.");
    }
    if (!(await this.teamSpaceRepository.remove(account.id, teamId))) {
      throw new TeamSpaceNotFoundError();
    }
    if ((await this.activeTeamId(account, sessionToken)) === account.id) {
      await this.sessionRepository.setActiveTeam(hashSessionToken(sessionToken), null);
    }
  }

  private async activeTeamId(account: TeamOwner, sessionToken: string): Promise<string> {
    const session = await this.sessionRepository.findValidByTokenHash(hashSessionToken(sessionToken));
    const chosen = session?.activeTeamId;
    return chosen && (await this.ownsSpace(account, chosen)) ? chosen : account.id;
  }

  private async ownsSpace(account: TeamOwner, teamId: string): Promise<boolean> {
    const space = await this.educatorRepository.findById(teamId);
    return space?.role === "team" && space.ownerEducatorId === account.id;
  }

  // Un adjoint suit l'équipe qui l'a invité : il ne crée ni ne change d'équipe.
  private requireCoach(account: TeamOwner): void {
    if ((account.role ?? "coach") !== "coach") {
      throw new ValidationError("Seul l’éducateur titulaire gère ses équipes.");
    }
  }
}
