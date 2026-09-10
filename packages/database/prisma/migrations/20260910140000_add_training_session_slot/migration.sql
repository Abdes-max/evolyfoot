-- Créneau de la séance dans le cycle de 4 semaines : semaine du plan (1 à 4) + slot (index 0-basé
-- dans les jours d'entraînement de l'équipe).
ALTER TABLE "training_sessions" ADD COLUMN "week_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "training_sessions" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 0;

-- Backfill : répartir les séances déjà enregistrées d'un même éducateur sur des slots distincts
-- (ordre chronologique) pour ne pas violer la contrainte d'unicité ajoutée juste après.
WITH ranked AS (
  SELECT "id", CAST(ROW_NUMBER() OVER (PARTITION BY "educator_id" ORDER BY "created_at") AS INTEGER) - 1 AS rn
  FROM "training_sessions"
)
UPDATE "training_sessions" AS t
SET "slot" = ranked.rn
FROM ranked
WHERE t."id" = ranked."id";

-- CreateIndex
CREATE UNIQUE INDEX "training_sessions_educator_id_week_number_slot_key" ON "training_sessions"("educator_id", "week_number", "slot");
