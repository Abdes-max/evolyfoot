-- CreateTable
CREATE TABLE "diagnostics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "availability" INTEGER NOT NULL,
    "scanning" INTEGER NOT NULL,
    "progression" INTEGER NOT NULL,
    "reaction_after_loss" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnostics_educator_id_key" ON "diagnostics"("educator_id");

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
