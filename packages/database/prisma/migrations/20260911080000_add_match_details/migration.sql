-- Rendez-vous, lieu précis et description libre d'un match -- distincts de date_label (voir le
-- commentaire dans schema.prisma), affichés sur la page de détail du joueur/tuteur.
ALTER TABLE "matches" ADD COLUMN "meeting_time" TEXT;
ALTER TABLE "matches" ADD COLUMN "location" TEXT;
ALTER TABLE "matches" ADD COLUMN "description" TEXT;
