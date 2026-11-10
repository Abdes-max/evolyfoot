-- Tournoi ou plateau marqué comme terminé par le coach.
ALTER TABLE "tournaments" ADD COLUMN "finished_at" TIMESTAMP(3);
ALTER TABLE "plateaux" ADD COLUMN "finished_at" TIMESTAMP(3);
