-- Add legacy_id for round-tripping old mobile-client integer IDs.
-- Nullable because nothing post-migration has one.
ALTER TABLE `feedbacks` ADD COLUMN `legacy_id` INT NULL;
CREATE UNIQUE INDEX `feedbacks_legacy_id_key` ON `feedbacks`(`legacy_id`);
