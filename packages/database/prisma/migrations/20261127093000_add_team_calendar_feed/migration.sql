ALTER TABLE "teams" ADD COLUMN "calendar_feed_url" TEXT;
ALTER TABLE "matches" ADD COLUMN "from_feed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "matches" ADD COLUMN "feed_uid" TEXT;

CREATE UNIQUE INDEX "matches_educator_id_feed_uid_key" ON "matches"("educator_id", "feed_uid");
