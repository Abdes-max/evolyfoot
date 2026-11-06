import type {
  AgeGroup,
  AttendanceEntry,
  DevelopmentTheme,
  DiagnosticScores,
  GameFormat,
  MatchLineupAssignment,
  MatchStatus,
  MatchVenue,
  MessageAuthorRole,
  ObservationEventType,
  ObservationReport,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerEvaluationScores,
  PersonalExercise,
  PersonalExerciseInput,
  PlayerReference,
  PlayerSignal,
  TeamProfile,
  MatchPlayerStat,
  PlayerSelection,
} from "@evolyfoot/domain";

// "team" : espace d'une équipe supplémentaire d'un éducateur, sans connexion possible.
export type AccountRole = "coach" | "player" | "assistant" | "team";

export interface EducatorRecord {
  id: string;
  email: string;
  displayName: string;
  // "coach" : compte éducateur classique (valeur par défaut, absente ⇒ coach). "player" : compte
  // tuteur/joueur, `linkedPlayerId` renseigné, ne voit que le suivi de ce joueur.
  role?: AccountRole;
  linkedPlayerId?: string | null;
  // Compte "assistant" : l'éducateur dont il partage l'équipe.
  ownerEducatorId?: string | null;
  // Rempli une fois le lien de confirmation (envoyé à l'inscription) cliqué. Optionnel comme
  // `role`/`linkedPlayerId` : absent = compte créé avant cette fonctionnalité, traité comme non
  // confirmé côté affichage sans casser les faux de test existants.
  emailVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorAuthRecord extends EducatorRecord {
  passwordHash: string;
}

// Invitation coach -> tuteur (voir PlayerInvite côté schéma). `tokenHash` seulement, jamais le
// jeton en clair.
export interface PlayerInviteRecord {
  id: string;
  educatorId: string;
  playerId: string;
  tokenHash: string;
  // Lien en clair, réaffichable à l'éducateur (null pour une invitation d'avant ce choix).
  token: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface PlayerInviteRepository {
  create(input: { educatorId: string; playerId: string; tokenHash: string; token: string; expiresAt: Date }): Promise<PlayerInviteRecord>;
  findByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null>;
  // Lien encore valable et réaffichable pour ce joueur (le plus récent).
  findCurrentForPlayer(playerId: string, now: Date): Promise<PlayerInviteRecord | null>;
  // Invalide les liens de ce joueur (nouveau lien demandé par l'éducateur).
  expireForPlayer(playerId: string, now: Date): Promise<void>;
  markConsumed(id: string): Promise<void>;
}

// Lien de confirmation envoyé par e-mail à l'inscription. Même forme que PlayerInviteRecord.
export interface EmailVerificationRecord {
  id: string;
  educatorId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetRecord {
  id: string;
  educatorId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface PasswordResetRepository {
  countCreatedSince(educatorId: string, since: Date): Promise<number>;
  // Crée le lien et annule ceux encore valides pour ce compte.
  replaceForEducator(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetRecord | null>;
  // Atomique : consomme le lien, change le mot de passe et ferme les sessions. `false` si le lien
  // a déjà été consommé entre-temps.
  apply(id: string, educatorId: string, passwordHash: string): Promise<boolean>;
}

export interface EmailVerificationRepository {
  create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<EmailVerificationRecord>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationRecord | null>;
  markConsumed(id: string): Promise<void>;
}

// Fiche profil (page /profil) : champs optionnels renseignés après l'inscription. Sans
// `passwordHash` -- jamais renvoyé au client (le changement de mot de passe passe par
// `findAuthById` + `updatePasswordHash`).
export interface EducatorProfile {
  id: string;
  email: string;
  displayName: string;
  birthDate: string | null;
  club: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  diploma: string | null;
  seasonFormat: string | null;
  playStyle: string | null;
  preferredFormation: string | null;
  createdAt: Date;
}

// Patch partiel : une clé absente n'est pas touchée, une clé à `null` efface le champ.
export type EducatorProfilePatch = Partial<{
  displayName: string;
  birthDate: string | null;
  club: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  diploma: string | null;
  seasonFormat: string | null;
  playStyle: string | null;
  preferredFormation: string | null;
}>;

export interface PersistedTeamProfile {
  id: string;
  educatorId: string;
  profile: TeamProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffMember {
  id: string;
  displayName: string;
  email: string;
  createdAt: Date;
}

export interface StaffInviteRecord {
  id: string;
  educatorId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface StaffRepository {
  listMembers(ownerId: string): Promise<StaffMember[]>;
  createInvite(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findInviteByTokenHash(tokenHash: string): Promise<StaffInviteRecord | null>;
  // `false` si l'invitation a déjà servi : à appeler avant de créer le compte.
  consumeInvite(id: string): Promise<boolean>;
  removeMember(ownerId: string, memberId: string): Promise<boolean>;
}

export interface EducatorRepository {
  create(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role?: AccountRole;
    linkedPlayerId?: string;
    ownerEducatorId?: string;
  }): Promise<EducatorRecord>;
  existsById(id: string): Promise<boolean>;
  findById(id: string): Promise<EducatorRecord | null>;
  findByEmail(email: string): Promise<EducatorAuthRecord | null>;
  // Comptes tuteur/joueur qui suivent ce joueur (les deux parents, par exemple).
  findFollowers(playerId: string): Promise<EducatorRecord[]>;
  markEmailVerified(id: string): Promise<void>;
}

// Enfants suivis par un compte tuteur/joueur (table player_followers) et enfant affiché
// (Educator.linkedPlayerId).
// Demande de suivi en attente de l'accord de l'éducateur (voir PlayerFollowRequest côté schéma).
export interface FollowRequestRecord {
  id: string;
  accountId: string;
  playerId: string;
  createdAt: Date;
  account: { displayName: string; email: string };
}

export interface FollowerRecord {
  accountId: string;
  displayName: string;
  email: string;
  since: Date;
}

export interface PlayerFollowerRepository {
  followedPlayerIds(accountId: string): Promise<string[]>;
  follow(accountId: string, playerId: string): Promise<void>;
  unfollow(accountId: string, playerId: string): Promise<void>;
  listFollowers(playerId: string): Promise<FollowerRecord[]>;
  // `null` : plus aucun enfant affiché (dernier enfant retiré, ou demande pas encore acceptée).
  setDisplayedPlayer(accountId: string, playerId: string | null): Promise<void>;
  requestFollow(accountId: string, playerId: string): Promise<void>;
  listRequests(playerId: string): Promise<FollowRequestRecord[]>;
  findRequest(id: string): Promise<FollowRequestRecord | null>;
  deleteRequest(id: string): Promise<void>;
  pendingPlayerIds(accountId: string): Promise<string[]>;
}

// Lecture/écriture de la fiche profil et du mot de passe -- interface distincte d'EducatorRepository
// (auth/inscription) pour que les services qui n'en ont pas besoin, ni leurs faux de test, n'aient
// pas à l'implémenter. PrismaEducatorRepository implémente les deux.
export interface EducatorProfileRepository {
  existsById(id: string): Promise<boolean>;
  findProfileById(id: string): Promise<EducatorProfile | null>;
  findAuthById(id: string): Promise<EducatorAuthRecord | null>;
  updateProfile(id: string, patch: EducatorProfilePatch): Promise<EducatorProfile>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export interface TeamRepository {
  upsertForEducator(educatorId: string, profile: TeamProfile): Promise<PersistedTeamProfile>;
  findForEducator(educatorId: string): Promise<PersistedTeamProfile | null>;
}

export interface PersistedDiagnostic {
  id: string;
  educatorId: string;
  scores: DiagnosticScores;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedSeasonProgram {
  educatorId: string;
  priorities: DevelopmentTheme[];
  startDate: Date;
}

export interface SeasonProgramRepository {
  upsertForEducator(educatorId: string, priorities: DevelopmentTheme[], startDate: Date): Promise<PersistedSeasonProgram>;
  findForEducator(educatorId: string): Promise<PersistedSeasonProgram | null>;
}

export interface DiagnosticRepository {
  upsertForEducator(educatorId: string, scores: DiagnosticScores): Promise<PersistedDiagnostic>;
  findForEducator(educatorId: string): Promise<PersistedDiagnostic | null>;
}

export interface SessionRecord {
  id: string;
  educatorId: string;
  // Espace d'équipe choisi pour cette session, `null` ou absent pour la première équipe.
  activeTeamId?: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface AccountRepository {
  exportData(id: string): Promise<Record<string, unknown> | null>;
  findPasswordHash(id: string): Promise<string | null>;
  delete(id: string): Promise<void>;
}

export interface SessionRepository {
  create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord>;
  findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteOthers(educatorId: string, keptTokenHash: string | null): Promise<void>;
  setActiveTeam(tokenHash: string, activeTeamId: string | null): Promise<void>;
}

// Espaces d'équipe (comptes "team") d'un éducateur.
export interface TeamSpaceRepository {
  listForOwner(ownerId: string): Promise<EducatorRecord[]>;
  // `false` si l'espace n'appartient pas à cet éducateur.
  remove(ownerId: string, teamSpaceId: string): Promise<boolean>;
}

// Historique des séances validées (contrairement à Team/Diagnostic, plusieurs par éducateur).
// `blocks` ne conserve que de quoi retrouver chaque activité dans le catalogue du domaine
// (`findTrainingActivity`), jamais l'activité complète.
export interface PersistedTrainingSessionBlock {
  id: string;
  activityId: string;
  durationMinutes: number;
}

export interface PersistedTrainingSession {
  id: string;
  educatorId: string;
  cycleNumber: number;
  title: string;
  ageGroup: AgeGroup;
  playerCount: number;
  theme: DevelopmentTheme;
  intention: string;
  blocks: PersistedTrainingSessionBlock[];
  // Créneau dans le cycle de 4 semaines : semaine du plan (1 à 4) + slot (index 0-basé dans les
  // jours d'entraînement de l'équipe). Une seule séance par créneau (voir `create`, un upsert).
  weekNumber: number;
  slot: number;
  // Rendez-vous (vrai horodatage), lieu et description -- voir le commentaire dans schema.prisma.
  meetingAt: Date | null;
  location: string | null;
  description: string | null;
  // `undefined` pour une séance validée avant l'introduction du suivi de présence, distingué
  // d'un tableau vide (présence saisie mais personne de présent) -- voir summarizeAttendance
  // côté domaine et /statistiques, qui doivent pouvoir faire la différence.
  attendance?: readonly AttendanceEntry[];
  // Convocation envoyée ; `null` (ou absent) : séance seulement « programmée », sans réponse possible.
  convokedAt?: Date | null;
  createdAt: Date;
}

export interface TrainingSessionRepository {
  // Upsert sur le créneau (educatorId, weekNumber, slot) : (re)générer une séance pour un créneau
  // déjà occupé remplace la précédente plutôt que d'en empiler une deuxième.
  create(
    educatorId: string,
    input: {
      title: string;
      ageGroup: AgeGroup;
      playerCount: number;
      theme: DevelopmentTheme;
      intention: string;
      blocks: PersistedTrainingSessionBlock[];
      cycleNumber: number;
      weekNumber: number;
      slot: number;
      // Rendez-vous (date + heure) -- obligatoire dès la génération de la séance (voir
      // TrainingSessionService.save), contrairement à `location`/`description`, réservés au
      // formulaire "Détails" une fois la séance déjà enregistrée.
      meetingAt: Date;
      location?: string | null;
      attendance?: readonly AttendanceEntry[];
      preparationSeconds?: number;
    },
  ): Promise<PersistedTrainingSession>;
  listByEducator(educatorId: string): Promise<PersistedTrainingSession[]>;
  currentCycle(educatorId: string): Promise<number>;
  // Passe au cycle suivant et renvoie son numéro.
  advanceCycle(educatorId: string): Promise<number>;
  findById(id: string, educatorId: string): Promise<PersistedTrainingSession | null>;
  // `updateMany` (filtre sur educatorId dans la même requête, voir PrismaMatchRepository.update
  // pour le même principe) -- réservé aux détails (rendez-vous/lieu/description) et à la présence,
  // jamais au contenu pédagogique de la séance (blocs), reconstruit uniquement via `create`.
  update(
    id: string,
    educatorId: string,
    input: {
      meetingAt?: Date | null;
      location?: string | null;
      description?: string | null;
      attendance?: readonly AttendanceEntry[];
      convokedAt?: Date;
    },
  ): Promise<PersistedTrainingSession>;
}

// Historique des observations validées. `players`/`signals` sont stockés tels quels (JSON), sans
// intégrité référentielle vers `Player` ci-dessous : une observation reste une photo figée d'un
// instant, pas une vue dynamique sur l'effectif actuel (un joueur renommé ou retiré plus tard ne
// doit pas modifier les observations passées).
export interface PersistedObservation {
  id: string;
  educatorId: string;
  eventType: ObservationEventType;
  title: string;
  dateLabel: string;
  players: readonly PlayerReference[];
  ratings: readonly ObservationReportRating[];
  signals: readonly PlayerSignal[];
  note?: string;
  summary: ObservationReportSummary;
  matchId?: string;
  createdAt: Date;
}

export interface ObservationRepository {
  create(educatorId: string, report: ObservationReport, matchId?: string, entrySeconds?: number): Promise<PersistedObservation>;
  listByEducator(educatorId: string): Promise<PersistedObservation[]>;
  findById(id: string, educatorId: string): Promise<PersistedObservation | null>;
  // `false` si l'observation n'existe pas ou n'appartient pas à cet éducateur.
  setAdjustmentDecision(id: string, educatorId: string, decision: AdjustmentDecision | null): Promise<boolean>;
}

export type AdjustmentDecision = "accepted" | "declined";

// Effectif nominatif de l'éducateur. Rattaché à l'éducateur (pas à Team) : CRUD complet, à
// l'inverse du patron append-only de TrainingSessionRecord/ObservationRecord ci-dessus. `rename`
// et `remove` prennent `educatorId` en plus de l'identifiant du joueur pour vérifier
// l'appartenance en une seule requête (jamais un `findById` puis un `update` séparés, qui
// laisserait une fenêtre où l'appartenance n'est plus vérifiée).
export interface PersistedPlayer {
  id: string;
  educatorId: string;
  firstName: string;
  lastName: string;
  // Nom complet dérivé (`${firstName} ${lastName}`.trim(), voir toPersistedPlayer côté mapper) --
  // tous les consommateurs qui n'ont besoin que d'une chaîne d'affichage unique (composition de
  // match, présence, messagerie, tableau de bord...) continuent de ne lire que ce champ, sans
  // connaître la distinction prénom/nom.
  name: string;
  // Fiche joueur, tous optionnels. `photo` = data URL redimensionnée côté client.
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  jerseyNumber: string | null;
  preferredFoot: string | null;
  strengths: string | null;
  workAreas: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Patch partiel de la fiche : clé absente ⇒ non touchée, `null` ⇒ efface (`firstName`/`lastName`
// ne s'effacent jamais, voir RosterService qui rejette une chaîne vide pour ces deux champs).
export type PlayerDetailsPatch = Partial<{
  firstName: string;
  lastName: string;
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  jerseyNumber: string | null;
  preferredFoot: string | null;
  strengths: string | null;
  workAreas: string | null;
}>;

export interface PlayerRepository {
  listByEducator(educatorId: string): Promise<PersistedPlayer[]>;
  findById(id: string, educatorId: string): Promise<PersistedPlayer | null>;
  // Sans filtre d'appartenance -- réservé au tableau de bord joueur, qui a déjà résolu le joueur
  // via `Educator.linkedPlayerId` (relation de confiance).
  findAnyById(id: string): Promise<PersistedPlayer | null>;
  // `lastName` optionnel (replié sur "" par l'implémentation) : uniquement pour ne pas casser les
  // très nombreux appels directs au repository dans les fixtures de test, qui n'ont besoin que
  // d'un nom d'affichage quelconque -- RosterService.add (le vrai point d'entrée applicatif) exige
  // les deux côté validation, voir son commentaire.
  create(educatorId: string, firstName: string, lastName?: string): Promise<PersistedPlayer>;
  rename(id: string, educatorId: string, firstName: string, lastName?: string): Promise<PersistedPlayer>;
  update(id: string, educatorId: string, patch: PlayerDetailsPatch): Promise<PersistedPlayer>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Préparation d'un match : CRUD complet comme Player (pas un historique append-only) puisque la
// composition se modifie librement jusqu'au coup d'envoi. `lineup`/`captainPlayerId` ne
// référencent les joueurs que par id + nom dupliqué (voir MatchLineupAssignment côté domaine),
// jamais de clé étrangère vers `Player` -- même principe que PersistedObservation.players : un
// joueur renommé ou retiré de l'effectif plus tard ne doit pas modifier une composition déjà
// préparée.
export interface PersistedMatch {
  id: string;
  educatorId: string;
  opponent: string;
  dateLabel: string;
  // Vraie date ET heure du coup d'envoi (voir le commentaire dans schema.prisma) -- `null` pour un
  // match créé avant l'introduction de ce champ, seul `dateLabel` reste fiable pour lui.
  date: Date | null;
  // Rendez-vous exprimé en minutes avant le coup d'envoi (voir matchMeetingTime côté base pour le
  // calcul) -- `null` si non renseigné, ou pour un match créé avant l'introduction de ce champ.
  meetingOffsetMinutes: number | null;
  // Lieu précis, distinct de `dateLabel` -- voir le commentaire sur le modèle Prisma. `null` si
  // le coach ne l'a pas renseigné. `meetingTime` (texte libre) reste le repli pour un rendez-vous
  // saisi avant `meetingOffsetMinutes`, voir matchMeetingTime.
  meetingTime: string | null;
  location: string | null;
  description: string | null;
  venue: MatchVenue;
  gameFormat: GameFormat;
  // Toujours une valeur concrète : résolue par le mapper (voir toPersistedMatch) sur la
  // formation par défaut du format de jeu si la colonne est vide en base.
  formationId: string;
  status: MatchStatus;
  lineup: readonly MatchLineupAssignment[];
  captainPlayerId: string | null;
  // Sur le banc, sans poste. Toujours un tableau concret : `undefined` en base (match préparé
  // avant l'introduction du banc) résolu en `[]` par le mapper, comme `formationId`.
  substitutePlayerIds: readonly string[];
  opponentFormationId: string | null;
  // `null` tant que l'éducateur n'a pas saisi le résultat.
  goalsFor: number | null;
  goalsAgainst: number | null;
  playerStats: readonly MatchPlayerStat[];
  // Distincte de `lineup` (qui est *prévu* à quel poste) : un joueur prévu peut ne pas s'être
  // présenté, et inversement. Même convention `undefined`/tableau vide que
  // PersistedTrainingSession.attendance ci-dessus.
  attendance?: readonly AttendanceEntry[];
  // Joueurs concernés : `null` = tout l'effectif, ou la composition pour un match créé avant ce
  // choix (voir matchConcernedIds).
  selectedPlayerIds: PlayerSelection;
  // Dernier envoi de la convocation, `null` tant qu'elle n'est pas partie.
  convokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchRepository {
  listByEducator(educatorId: string): Promise<PersistedMatch[]>;
  findById(id: string, educatorId: string): Promise<PersistedMatch | null>;
  create(
    educatorId: string,
    input: {
      opponent: string;
      dateLabel: string;
      venue: MatchVenue;
      gameFormat: GameFormat;
      formationId: string;
      date?: Date | null;
      meetingOffsetMinutes?: number | null;
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
      selectedPlayerIds?: PlayerSelection;
    },
  ): Promise<PersistedMatch>;
  update(
    id: string,
    educatorId: string,
    input: {
      opponent?: string;
      dateLabel?: string;
      date?: Date | null;
      venue?: MatchVenue;
      gameFormat?: GameFormat;
      formationId?: string;
      status?: MatchStatus;
      lineup?: readonly MatchLineupAssignment[];
      captainPlayerId?: string | null;
      substitutePlayerIds?: readonly string[];
      attendance?: readonly AttendanceEntry[];
      opponentFormationId?: string | null;
      goalsFor?: number;
      goalsAgainst?: number;
      playerStats?: readonly MatchPlayerStat[];
      meetingOffsetMinutes?: number | null;
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
      selectedPlayerIds?: PlayerSelection;
      convokedAt?: Date | null;
    },
  ): Promise<PersistedMatch>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Création et modification d'un tournoi ou d'un plateau (mêmes champs).
export interface CompetitionCreate {
  name: string;
  dateLabel: string;
  date?: Date | null;
  location?: string;
  result?: string;
  selectedPlayerIds?: PlayerSelection;
}

export interface CompetitionUpdate {
  date?: Date | null;
  location?: string | null;
  description?: string | null;
  result?: string | null;
  selectedPlayerIds?: PlayerSelection;
  convokedAt?: Date | null;
  attendance?: readonly AttendanceEntry[];
}

// Fiche simple comptée à part des matchs dans /statistiques -- voir TournamentInput côté domaine.
export interface PersistedTournament {
  id: string;
  educatorId: string;
  name: string;
  dateLabel: string;
  // Vraie date calendaire (voir le commentaire dans schema.prisma) -- `null` pour une fiche créée
  // avant l'introduction de ce champ, seul `dateLabel` reste fiable pour elle.
  date: Date | null;
  location: string | null;
  description: string | null;
  result: string | null;
  // Joueurs concernés (`null` = tout l'effectif), convocation et réponses : même principe que
  // PersistedTrainingSession.
  selectedPlayerIds: PlayerSelection;
  convokedAt: Date | null;
  attendance?: readonly AttendanceEntry[];
  createdAt: Date;
}

export interface TournamentRepository {
  listByEducator(educatorId: string): Promise<PersistedTournament[]>;
  findById(id: string, educatorId: string): Promise<PersistedTournament | null>;
  create(educatorId: string, input: CompetitionCreate): Promise<PersistedTournament>;
  // Lieu, description et bilan -- modifiables indépendamment depuis la fiche détail, même
  // principe que TrainingSessionRepository.update.
  update(id: string, educatorId: string, input: CompetitionUpdate): Promise<PersistedTournament>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Fiche simple d'un plateau -- même forme que PersistedTournament, comptée à part.
export interface PersistedPlateau {
  id: string;
  educatorId: string;
  name: string;
  dateLabel: string;
  date: Date | null;
  location: string | null;
  description: string | null;
  result: string | null;
  // Joueurs concernés (`null` = tout l'effectif), convocation et réponses : même principe que
  // PersistedTrainingSession.
  selectedPlayerIds: PlayerSelection;
  convokedAt: Date | null;
  attendance?: readonly AttendanceEntry[];
  createdAt: Date;
}

export interface PlateauRepository {
  listByEducator(educatorId: string): Promise<PersistedPlateau[]>;
  findById(id: string, educatorId: string): Promise<PersistedPlateau | null>;
  create(educatorId: string, input: CompetitionCreate): Promise<PersistedPlateau>;
  update(id: string, educatorId: string, input: CompetitionUpdate): Promise<PersistedPlateau>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Évaluation courante d'un joueur sur les 7 aspects de la toile d'araignée -- un seul
// enregistrement par joueur, mis à jour en place (même principe que Diagnostic).
export interface PersistedPlayerEvaluation {
  id: string;
  educatorId: string;
  playerId: string;
  scores: PlayerEvaluationScores;
  source: PlayerEvaluationSource;
  createdAt: Date;
}

export type PlayerEvaluationSource = "coach" | "player";

export interface PlayerEvaluationRepository {
  listByEducator(educatorId: string): Promise<PersistedPlayerEvaluation[]>;
  listByPlayer(playerId: string, educatorId: string): Promise<PersistedPlayerEvaluation[]>;
  // `since` limite le décompte à une période (la saison en cours pour la limite d'historique).
  countByPlayer(playerId: string, educatorId: string, source?: PlayerEvaluationSource, since?: Date): Promise<number>;
  create(educatorId: string, playerId: string, scores: PlayerEvaluationScores, source?: PlayerEvaluationSource): Promise<PersistedPlayerEvaluation>;
  // `undefined` = champ non touché ; jamais retiré une fois posé, mêmes conventions que
  // MatchRepository.update ci-dessus. `createdAt` sert de date d'évaluation modifiable (voir
  // PlayerEvaluationService.update) -- pas une simple trace d'audit dans ce contexte.
  update(id: string, educatorId: string, input: { scores?: PlayerEvaluationScores; createdAt?: Date }): Promise<PersistedPlayerEvaluation>;
  remove(id: string, educatorId: string): Promise<void>;
}

export interface ClubMember {
  id: string;
  displayName: string;
}

export interface ClubRecord {
  id: string;
  name: string;
  joinCode: string;
  members: ClubMember[];
}

// Exercice personnel d'un autre membre du club, avec le nom de son auteur.
export interface SharedClubExercise extends PersonalExercise {
  authorName: string;
}

export interface ClubRepository {
  findForMember(accountId: string): Promise<ClubRecord | null>;
  findIdByJoinCode(joinCode: string): Promise<string | null>;
  create(accountId: string, name: string, joinCode: string): Promise<ClubRecord>;
  setMembership(accountId: string, clubId: string | null): Promise<void>;
  deleteIfEmpty(clubId: string): Promise<void>;
  // Exercices des autres membres et de leurs équipes ajoutées, jamais ceux du compte demandeur.
  listSharedExercises(clubId: string, accountId: string): Promise<SharedClubExercise[]>;
}

export interface PersonalExerciseRepository {
  listByEducator(educatorId: string): Promise<PersonalExercise[]>;
  create(educatorId: string, input: PersonalExerciseInput): Promise<PersonalExercise>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Message du fil de discussion coach <-> joueur/tuteur (voir Message côté domaine et le
// commentaire dans schema.prisma). `educatorId` + `playerId` identifient le fil, même principe
// que PlayerInviteRecord.
export interface PersistedMessage {
  id: string;
  educatorId: string;
  playerId: string;
  authorRole: MessageAuthorRole;
  authorName: string;
  text: string;
  createdAt: Date;
}

export type NotificationKind = "message" | "evaluation" | "tutor-request";

export interface NotificationInput {
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  threadPlayerId?: string | null;
}

export interface NotificationRecord extends Required<NotificationInput> {
  id: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  // Personnes à prévenir côté coach : le titulaire de l'équipe (le coach derrière un espace d'équipe)
  // et ses adjoints.
  coachRecipients(educatorId: string): Promise<string[]>;
  // Comptes joueur/tuteur qui suivent ce joueur (aucun s'il n'a pas encore été invité).
  playerAccountIds(playerId: string): Promise<string[]>;
  createMany(inputs: NotificationInput[]): Promise<void>;
  list(recipientId: string, limit: number): Promise<NotificationRecord[]>;
  countUnread(recipientId: string, kind?: NotificationKind): Promise<number>;
  markRead(recipientId: string, filter: { ids?: string[]; threadPlayerId?: string; kind?: NotificationKind }): Promise<void>;
}

export interface PushDeviceRepository {
  register(educatorId: string, token: string, platform: string): Promise<void>;
  unregister(educatorId: string, token: string): Promise<void>;
  tokensFor(educatorIds: string[]): Promise<Array<{ educatorId: string; token: string }>>;
  removeTokens(tokens: string[]): Promise<void>;
}

export interface MessageRepository {
  listByPlayer(educatorId: string, playerId: string): Promise<PersistedMessage[]>;
  create(input: { educatorId: string; playerId: string; authorRole: MessageAuthorRole; authorName: string; text: string }): Promise<PersistedMessage>;
}
