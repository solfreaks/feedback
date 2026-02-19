-- AlterTable
ALTER TABLE `apps` ADD COLUMN `google_client_id` VARCHAR(191) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;
