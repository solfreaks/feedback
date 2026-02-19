-- CreateTable
CREATE TABLE `feedback_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `feedback_id` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `feedback_attachments_feedback_id_idx`(`feedback_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feedback_attachments` ADD CONSTRAINT `feedback_attachments_feedback_id_fkey` FOREIGN KEY (`feedback_id`) REFERENCES `feedbacks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
