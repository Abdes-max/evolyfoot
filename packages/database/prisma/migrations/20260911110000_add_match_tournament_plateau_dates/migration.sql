-- Vraie date calendaire (jour, nullable) pour matchs, tournois et plateaux -- jusqu'ici seul un
-- `date_label` en texte libre existait, insuffisant pour trier/regrouper par semaine de façon
-- fiable (voir le commentaire dans schema.prisma).
ALTER TABLE "matches" ADD COLUMN "date" TIMESTAMP(3);
ALTER TABLE "tournaments" ADD COLUMN "date" TIMESTAMP(3);
ALTER TABLE "plateaux" ADD COLUMN "date" TIMESTAMP(3);
