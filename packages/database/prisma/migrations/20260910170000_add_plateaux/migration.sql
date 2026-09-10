-- Fiche simple d'un plateau (rassemblement U6–U11), comptée à part des matchs et des tournois.
CREATE TABLE "plateaux" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plateaux_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plateaux_educator_id_idx" ON "plateaux"("educator_id");

ALTER TABLE "plateaux" ADD CONSTRAINT "plateaux_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
