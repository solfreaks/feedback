-- Multilanguage canned replies: optional BCP-47 locale filter on shared templates.
ALTER TABLE `canned_replies` ADD COLUMN `locale` VARCHAR(191) NULL;

-- Per-message attachments: tie each ticket attachment optionally to a comment row.
-- Unlinked (NULL comment_id) attachments remain attached to the ticket itself.
ALTER TABLE `ticket_attachments` ADD COLUMN `comment_id` VARCHAR(191) NULL;
CREATE INDEX `ticket_attachments_comment_id_idx` ON `ticket_attachments`(`comment_id`);

-- Feedback device metadata so admins can see OS / app version / device type
-- alongside the report. Optional on the submit API; legacy rows stay NULL.
ALTER TABLE `feedbacks` ADD COLUMN `device_type` VARCHAR(191) NULL;
ALTER TABLE `feedbacks` ADD COLUMN `os_version` VARCHAR(191) NULL;
ALTER TABLE `feedbacks` ADD COLUMN `app_version` VARCHAR(191) NULL;
