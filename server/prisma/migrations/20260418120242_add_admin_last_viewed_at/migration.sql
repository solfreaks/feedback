-- AlterTable
ALTER TABLE `apps` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feedbacks` ADD COLUMN `admin_last_viewed_at` DATETIME(3) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `admin_last_viewed_at` DATETIME(3) NULL;
