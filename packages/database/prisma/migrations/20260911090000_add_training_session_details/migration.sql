-- Rendez-vous (vrai horodatage, pas un texte libre comme matches.meeting_time -- voir le
-- commentaire dans schema.prisma), lieu précis et description libre d'une séance -- affichés sur
-- la page de détail du joueur/tuteur, même principe que la migration équivalente pour les matchs
-- (20260911080000_add_match_details).
ALTER TABLE "training_sessions" ADD COLUMN "meeting_at" TIMESTAMP(3);
ALTER TABLE "training_sessions" ADD COLUMN "location" TEXT;
ALTER TABLE "training_sessions" ADD COLUMN "description" TEXT;
