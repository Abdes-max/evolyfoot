-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "goals_against" INTEGER,
ADD COLUMN     "goals_for" INTEGER,
ADD COLUMN     "player_stats" JSONB;
