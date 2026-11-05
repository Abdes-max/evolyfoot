-- Convocations aux entraînements : réglage d'envoi et de réponse par défaut sur l'équipe, date
-- d'envoi sur la séance.
CREATE TYPE "AttendanceDefault" AS ENUM ('present', 'ask');

ALTER TABLE "teams" ADD COLUMN "convocation_lead_days" INTEGER;
ALTER TABLE "teams" ADD COLUMN "attendance_default" "AttendanceDefault";

ALTER TABLE "training_sessions" ADD COLUMN "convoked_at" TIMESTAMP(3);

-- Jusqu'ici, toute séance était ouverte aux réponses : on garde ce comportement pour l'existant.
UPDATE "training_sessions" SET "convoked_at" = "created_at";
