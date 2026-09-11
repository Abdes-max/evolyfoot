import type {
  AgeGroup,
  AttendanceEntry,
  DevelopmentTheme,
  DiagnosticScores,
  GameFormat,
  MatchLineupAssignment,
  MatchStatus,
  MatchVenue,
  ObservationEventType,
  ObservationReport,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerEvaluationScores,
  PlayerReference,
  PlayerSignal,
  TeamProfile,
} from "@evolyfoot/domain";

export type AccountRole = "coach" | "player";

export interface EducatorRecord {
  id: string;
  email: string;
  displayName: string;
  // "coach" : compte éducateur classique (valeur par défaut, absente ⇒ coach). "player" : compte
  // tuteur/joueur, `linkedPlayerId` renseigné, ne voit que le suivi de ce joueur.
  role?: AccountRole;
  linkedPlayerId?: string | null;
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
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface PlayerInviteRepository {
  create(input: { educatorId: string; playerId: string; tokenHash: string; expiresAt: Date }): Promise<PlayerInviteRecord>;
  findByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null>;
  findActiveForPlayer(playerId: string): Promise<PlayerInviteRecord | null>;
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
}>;

export interface PersistedTeamProfile {
  id: string;
  educatorId: string;
  profile: TeamProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorRepository {
  create(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role?: AccountRole;
    linkedPlayerId?: string;
  }): Promise<EducatorRecord>;
  existsById(id: string): Promise<boolean>;
  findById(id: string): Promise<EducatorRecord | null>;
  findByEmail(email: string): Promise<EducatorAuthRecord | null>;
  // Compte "player" lié à ce joueur, s'il existe (0..1 via l'unique sur linked_player_id).
  findByLinkedPlayerId(playerId: string): Promise<EducatorRecord | null>;
  markEmailVerified(id: string): Promise<void>;
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

export interface DiagnosticRepository {
  upsertForEducator(educatorId: string, scores: DiagnosticScores): Promise<PersistedDiagnostic>;
  findForEducator(educatorId: string): Promise<PersistedDiagnostic | null>;
}

export interface SessionRecord {
  id: string;
  educatorId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionRepository {
  create(input: { educatorId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord>;
  findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
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
      weekNumber: number;
      slot: number;
      attendance?: readonly AttendanceEntry[];
    },
  ): Promise<PersistedTrainingSession>;
  listByEducator(educatorId: string): Promise<PersistedTrainingSession[]>;
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
  create(educatorId: string, report: ObservationReport, matchId?: string): Promise<PersistedObservation>;
  listByEducator(educatorId: string): Promise<PersistedObservation[]>;
  findById(id: string, educatorId: string): Promise<PersistedObservation | null>;
}

// Effectif nominatif de l'éducateur. Rattaché à l'éducateur (pas à Team) : CRUD complet, à
// l'inverse du patron append-only de TrainingSessionRecord/ObservationRecord ci-dessus. `rename`
// et `remove` prennent `educatorId` en plus de l'identifiant du joueur pour vérifier
// l'appartenance en une seule requête (jamais un `findById` puis un `update` séparés, qui
// laisserait une fenêtre où l'appartenance n'est plus vérifiée).
export interface PersistedPlayer {
  id: string;
  educatorId: string;
  name: string;
  // Fiche joueur, tous optionnels. `photo` = data URL redimensionnée côté client.
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Patch partiel de la fiche : clé absente ⇒ non touchée, `null` ⇒ efface.
export type PlayerDetailsPatch = Partial<{
  name: string;
  photo: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
}>;

export interface PlayerRepository {
  listByEducator(educatorId: string): Promise<PersistedPlayer[]>;
  findById(id: string, educatorId: string): Promise<PersistedPlayer | null>;
  // Sans filtre d'appartenance -- réservé au tableau de bord joueur, qui a déjà résolu le joueur
  // via `Educator.linkedPlayerId` (relation de confiance).
  findAnyById(id: string): Promise<PersistedPlayer | null>;
  create(educatorId: string, name: string): Promise<PersistedPlayer>;
  rename(id: string, educatorId: string, name: string): Promise<PersistedPlayer>;
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
  // Rendez-vous et lieu précis, distincts de `dateLabel` -- voir le commentaire sur le modèle
  // Prisma. `null` si le coach ne les a pas renseignés.
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
  // Distincte de `lineup` (qui est *prévu* à quel poste) : un joueur prévu peut ne pas s'être
  // présenté, et inversement. Même convention `undefined`/tableau vide que
  // PersistedTrainingSession.attendance ci-dessus.
  attendance?: readonly AttendanceEntry[];
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
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<PersistedMatch>;
  update(
    id: string,
    educatorId: string,
    input: {
      opponent?: string;
      dateLabel?: string;
      venue?: MatchVenue;
      formationId?: string;
      status?: MatchStatus;
      lineup?: readonly MatchLineupAssignment[];
      captainPlayerId?: string | null;
      substitutePlayerIds?: readonly string[];
      attendance?: readonly AttendanceEntry[];
      meetingTime?: string | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<PersistedMatch>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Fiche simple comptée à part des matchs dans /statistiques -- voir TournamentInput côté domaine.
export interface PersistedTournament {
  id: string;
  educatorId: string;
  name: string;
  dateLabel: string;
  result: string | null;
  createdAt: Date;
}

export interface TournamentRepository {
  listByEducator(educatorId: string): Promise<PersistedTournament[]>;
  create(educatorId: string, input: { name: string; dateLabel: string; result?: string }): Promise<PersistedTournament>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Fiche simple d'un plateau -- même forme que PersistedTournament, comptée à part.
export interface PersistedPlateau {
  id: string;
  educatorId: string;
  name: string;
  dateLabel: string;
  result: string | null;
  createdAt: Date;
}

export interface PlateauRepository {
  listByEducator(educatorId: string): Promise<PersistedPlateau[]>;
  create(educatorId: string, input: { name: string; dateLabel: string; result?: string }): Promise<PersistedPlateau>;
  remove(id: string, educatorId: string): Promise<void>;
}

// Évaluation courante d'un joueur sur les 7 aspects de la toile d'araignée -- un seul
// enregistrement par joueur, mis à jour en place (même principe que Diagnostic).
export interface PersistedPlayerEvaluation {
  id: string;
  educatorId: string;
  playerId: string;
  scores: PlayerEvaluationScores;
  createdAt: Date;
}

export interface PlayerEvaluationRepository {
  listByEducator(educatorId: string): Promise<PersistedPlayerEvaluation[]>;
  listByPlayer(playerId: string, educatorId: string): Promise<PersistedPlayerEvaluation[]>;
  countByPlayer(playerId: string, educatorId: string): Promise<number>;
  create(educatorId: string, playerId: string, scores: PlayerEvaluationScores): Promise<PersistedPlayerEvaluation>;
  // `undefined` = champ non touché ; jamais retiré une fois posé, mêmes conventions que
  // MatchRepository.update ci-dessus. `createdAt` sert de date d'évaluation modifiable (voir
  // PlayerEvaluationService.update) -- pas une simple trace d'audit dans ce contexte.
  update(
    id: string,
    educatorId: string,
    input: { scores?: PlayerEvaluationScores; createdAt?: Date },
  ): Promise<PersistedPlayerEvaluation>;
  remove(id: string, educatorId: string): Promise<void>;
}
