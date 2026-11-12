-- Composition d'un tournoi ou d'un plateau (format, formation, titulaires, capitaine, remplaçants).
ALTER TABLE "tournaments" ADD COLUMN "lineup" JSONB;
ALTER TABLE "plateaux" ADD COLUMN "lineup" JSONB;
