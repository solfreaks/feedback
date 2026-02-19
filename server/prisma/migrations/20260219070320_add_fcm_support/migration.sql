-- AlterTable
ALTER TABLE `apps` ADD COLUMN `firebase_client_email` VARCHAR(191) NULL,
    ADD COLUMN `firebase_private_key` TEXT NULL,
    ADD COLUMN `firebase_project_id` VARCHAR(191) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `device_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `platform` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `device_tokens_user_id_idx`(`user_id`),
    INDEX `device_tokens_app_id_idx`(`app_id`),
    UNIQUE INDEX `device_tokens_user_id_token_key`(`user_id`, `token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `device_tokens` ADD CONSTRAINT `device_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_tokens` ADD CONSTRAINT `device_tokens_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
