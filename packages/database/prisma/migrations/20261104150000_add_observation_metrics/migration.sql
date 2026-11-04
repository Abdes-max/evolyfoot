-- AlterTable
ALTER TABLE "observations" ADD COLUMN "entry_seconds" INTEGER,
ADD COLUMN "adjustment_decision" TEXT,
ADD COLUMN "adjustment_decided_at" TIMESTAMP(3);
