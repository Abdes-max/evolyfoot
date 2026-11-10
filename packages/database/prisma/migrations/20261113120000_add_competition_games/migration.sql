-- Rencontres (score, buteurs, passeurs) d'un tournoi ou d'un plateau, en JSON.
ALTER TABLE "tournaments" ADD COLUMN "games" JSONB;
ALTER TABLE "plateaux" ADD COLUMN "games" JSONB;
