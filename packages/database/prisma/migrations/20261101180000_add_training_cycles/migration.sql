-- DropIndex
DROP INDEX "training_sessions_educator_id_week_number_slot_key";

-- AlterTable
ALTER TABLE "educators" ADD COLUMN     "current_cycle" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "cycle_number" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "training_sessions_educator_id_cycle_number_week_number_slot_key" ON "training_sessions"("educator_id", "cycle_number", "week_number", "slot");
