-- Match, tournoi ou plateau annulé par le coach, avec la raison communiquée aux joueurs.
ALTER TABLE "matches" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "cancellation_note" TEXT;
ALTER TABLE "tournaments" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "tournaments" ADD COLUMN "cancellation_note" TEXT;
ALTER TABLE "plateaux" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "plateaux" ADD COLUMN "cancellation_note" TEXT;
