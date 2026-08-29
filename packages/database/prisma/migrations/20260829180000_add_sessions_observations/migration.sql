-- CreateEnum
CREATE TYPE "DevelopmentTheme" AS ENUM ('Conserver le ballon', 'Progresser ensemble', 'Finir les actions', 'Récupérer rapidement');

-- CreateEnum
CREATE TYPE "ObservationEventType" AS ENUM ('training', 'match');

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "age_group" "AgeGroup" NOT NULL,
    "player_count" INTEGER NOT NULL,
    "theme" "DevelopmentTheme" NOT NULL,
    "intention" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "event_type" "ObservationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "ratings" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "note" TEXT,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_sessions_educator_id_idx" ON "training_sessions"("educator_id");

-- CreateIndex
CREATE INDEX "observations_educator_id_idx" ON "observations"("educator_id");

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
