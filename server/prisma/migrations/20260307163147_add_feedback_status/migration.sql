-- AlterTable
ALTER TABLE `apps` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feedbacks` ADD COLUMN `status` ENUM('new', 'acknowledged', 'in_progress', 'resolved') NOT NULL DEFAULT 'new';
