-- AlterTable
ALTER TABLE "educators" ADD COLUMN "suspended_at" TIMESTAMP(3),
ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "impersonated_by_super_admin_id" UUID;

-- CreateTable
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_sessions" (
    "id" UUID NOT NULL,
    "super_admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "super_admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_sessions_token_hash_key" ON "super_admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "super_admin_sessions_super_admin_id_idx" ON "super_admin_sessions"("super_admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_super_admin_id_idx" ON "admin_audit_logs"("super_admin_id");

-- AddForeignKey
ALTER TABLE "super_admin_sessions" ADD CONSTRAINT "super_admin_sessions_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
