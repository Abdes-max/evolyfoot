ALTER TABLE "players" ADD COLUMN "first_name" TEXT;
ALTER TABLE "players" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

UPDATE "players" SET
  "first_name" = split_part("name", ' ', 1),
  "last_name" = CASE
    WHEN position(' ' in "name") > 0 THEN trim(substring("name" from position(' ' in "name") + 1))
    ELSE ''
  END;

ALTER TABLE "players" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "players" DROP COLUMN "name";
