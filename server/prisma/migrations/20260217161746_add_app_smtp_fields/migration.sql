-- AlterTable
ALTER TABLE `apps` ADD COLUMN `smtp_host` VARCHAR(191) NULL,
    ADD COLUMN `smtp_pass` VARCHAR(191) NULL,
    ADD COLUMN `smtp_port` INTEGER NULL,
    ADD COLUMN `smtp_user` VARCHAR(191) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;
