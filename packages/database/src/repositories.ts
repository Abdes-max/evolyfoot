import type {
  AgeGroup,
  DevelopmentTheme,
  DiagnosticScores,
  ObservationEventType,
  ObservationReport,
  ObservationReportRating,
  ObservationReportSummary,
  PlayerReference,
  PlayerSignal,
  TeamProfile,
} from "@evolyfoot/domain";

export interface EducatorRecord {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorAuthRecord extends EducatorRecord {
  passwordHash: string;
}

export interface PersistedTeamProfile {
  id: string;
  educatorId: string;
  profile: TeamProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducatorRepository {
  create(input: { email: string; displayName: string; passwordHash: string }): Promise<EducatorRecord>;
  existsById(id: string): Promise<boolean>;
  findById(id: string): Promise<EducatorRecord | null>;
  findByEmail(email: string): Promise<EducatorAuthRecord | null>;
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
  createdAt: Date;
}

export interface TrainingSessionRepository {
  create(
    educatorId: string,
    input: {
      title: string;
      ageGroup: AgeGroup;
      playerCount: number;
      theme: DevelopmentTheme;
      intention: string;
      blocks: PersistedTrainingSessionBlock[];
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
  createdAt: Date;
}

export interface ObservationRepository {
  create(educatorId: string, report: ObservationReport): Promise<PersistedObservation>;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerRepository {
  listByEducator(educatorId: string): Promise<PersistedPlayer[]>;
  create(educatorId: string, name: string): Promise<PersistedPlayer>;
  rename(id: string, educatorId: string, name: string): Promise<PersistedPlayer>;
  remove(id: string, educatorId: string): Promise<void>;
}
