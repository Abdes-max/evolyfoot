-- Entraînement annulé par le coach, avec la raison communiquée aux joueurs.
ALTER TABLE "training_sessions" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "training_sessions" ADD COLUMN "cancellation_note" TEXT;
