-- Joueurs concernés par un match, un tournoi, un plateau et par les entraînements (null = tout
-- l'effectif), convocation et réponses des tournois et plateaux.
ALTER TABLE "matches" ADD COLUMN "selected_player_ids" JSONB;
ALTER TABLE "teams" ADD COLUMN "training_player_ids" JSONB;
ALTER TABLE "tournaments" ADD COLUMN "selected_player_ids" JSONB,
ADD COLUMN "convoked_at" TIMESTAMP(3),
ADD COLUMN "attendance" JSONB;
ALTER TABLE "plateaux" ADD COLUMN "selected_player_ids" JSONB,
ADD COLUMN "convoked_at" TIMESTAMP(3),
ADD COLUMN "attendance" JSONB;

-- Jusqu'ici, un match concernait les joueurs de sa composition : on la reprend comme joueurs
-- concernés. Un match sans composition concerne tout l'effectif (NULL).
UPDATE "matches"
SET "selected_player_ids" = (SELECT jsonb_agg(DISTINCT assignment->>'playerId') FROM jsonb_array_elements("lineup") AS assignment)
WHERE jsonb_array_length("lineup") > 0;
