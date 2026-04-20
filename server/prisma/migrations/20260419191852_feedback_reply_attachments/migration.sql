-- AlterTable
ALTER TABLE `apps` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feedback_attachments` ADD COLUMN `feedback_reply_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `feedbacks` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `feedback_attachments_feedback_reply_id_idx` ON `feedback_attachments`(`feedback_reply_id`);

-- AddForeignKey
ALTER TABLE `feedback_attachments` ADD CONSTRAINT `feedback_attachments_feedback_reply_id_fkey` FOREIGN KEY (`feedback_reply_id`) REFERENCES `feedback_replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
