-- CreateTable
CREATE TABLE "personal_exercises" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "observable" TEXT NOT NULL,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_exercises_educator_id_idx" ON "personal_exercises"("educator_id");

-- AddForeignKey
ALTER TABLE "personal_exercises" ADD CONSTRAINT "personal_exercises_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
