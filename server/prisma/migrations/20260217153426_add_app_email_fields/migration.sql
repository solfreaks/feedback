-- AlterTable
ALTER TABLE `apps` ADD COLUMN `email_from` VARCHAR(191) NULL,
    ADD COLUMN `email_name` VARCHAR(191) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;
