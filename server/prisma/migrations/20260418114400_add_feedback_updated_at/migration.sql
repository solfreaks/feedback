-- AlterTable (unrelated drift — apps.updated_at default mismatch)
ALTER TABLE `apps` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable: add feedbacks.updated_at.
-- Step 1: add with a default so existing 39+ rows get a sensible value.
-- Step 2: backfill to each row's created_at so unread-diff logic doesn't
--         flag every pre-existing feedback as "just updated".
-- Step 3: drop the default so @updatedAt is the sole source of truth going
--         forward. Prisma @updatedAt is application-managed, not DB-managed,
--         so we don't want a server-side ON UPDATE clause either.
ALTER TABLE `feedbacks`
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `feedbacks` SET `updated_at` = `created_at`;

ALTER TABLE `feedbacks` ALTER COLUMN `updated_at` DROP DEFAULT;
