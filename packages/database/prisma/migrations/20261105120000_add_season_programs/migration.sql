-- CreateTable
CREATE TABLE "season_programs" (
    "id" UUID NOT NULL,
    "educator_id" UUID NOT NULL,
    "priorities" "DevelopmentTheme"[],
    "start_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "season_programs_educator_id_key" ON "season_programs"("educator_id");

-- AddForeignKey
ALTER TABLE "season_programs" ADD CONSTRAINT "season_programs_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "educators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
