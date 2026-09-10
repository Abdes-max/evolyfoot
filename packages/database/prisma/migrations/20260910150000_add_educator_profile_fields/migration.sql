-- Fiche profil de l'éducateur (page /profil) : tous les champs sont optionnels.
ALTER TABLE "educators" ADD COLUMN "birth_date" TEXT;
ALTER TABLE "educators" ADD COLUMN "club" TEXT;
ALTER TABLE "educators" ADD COLUMN "country" TEXT;
ALTER TABLE "educators" ADD COLUMN "address" TEXT;
ALTER TABLE "educators" ADD COLUMN "phone" TEXT;
ALTER TABLE "educators" ADD COLUMN "diploma" TEXT;
ALTER TABLE "educators" ADD COLUMN "season_format" TEXT;
