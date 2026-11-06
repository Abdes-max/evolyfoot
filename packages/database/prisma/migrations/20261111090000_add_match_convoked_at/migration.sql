-- Date d'envoi de la convocation d'un match, pour afficher « convocation envoyée » ou non.
ALTER TABLE "matches" ADD COLUMN "convoked_at" TIMESTAMP(3);
