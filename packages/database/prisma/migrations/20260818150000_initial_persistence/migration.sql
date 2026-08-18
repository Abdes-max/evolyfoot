-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('U10', 'U11', 'U12', 'U13');

-- CreateEnum
CREATE TYPE "TrainingDay" AS ENUM ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi');

-- CreateTable
CREATE TABLE "educators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age_group" "AgeGroup" NOT NULL,
    "player_count" INTEGER NOT NULL,
    "sessions_per_week" INTEGER NOT NULL,
    "training_days" "TrainingDay"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "educators_email_key" ON "educators"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teams_educator_id_key" ON "teams"("educator_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
