-- AlterTable
ALTER TABLE `apps` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feedbacks` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `notification_preferences` MODIFY `type` ENUM('new_ticket', 'ticket_update', 'new_feedback', 'new_comment', 'feedback_reply', 'mention') NOT NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('new_ticket', 'ticket_update', 'new_feedback', 'new_comment', 'feedback_reply', 'mention') NOT NULL;
