-- CreateEnum
CREATE TYPE "MatchVenue" AS ENUM ('home', 'away');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'played');

-- AlterTable
ALTER TABLE "diagnostics" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "educators" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "match_id" UUID,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "players" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "training_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "opponent" TEXT NOT NULL,
    "date_label" TEXT NOT NULL,
    "venue" "MatchVenue" NOT NULL,
    "game_format" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "lineup" JSONB NOT NULL DEFAULT '[]',
    "captain_player_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_educator_id_idx" ON "matches"("educator_id");

-- CreateIndex
CREATE INDEX "observations_match_id_idx" ON "observations"("match_id");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
