-- SynFit Relational Database Schema for MariaDB / MySQL
-- Database: synfit_db

CREATE DATABASE IF NOT EXISTS `synfit_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `synfit_db`;

-- 1. Users (Staff, Admin, Owner)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(128) NOT NULL,
  `username` VARCHAR(64) UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `name` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'OWNER', 'STAFF', 'DEVELOPER') NOT NULL DEFAULT 'STAFF',
  `photo_url` TEXT,
  `initial` VARCHAR(8),
  `settings` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Members (Registered Gym Members)
CREATE TABLE IF NOT EXISTS `members` (
  `id` VARCHAR(128) NOT NULL,
  `uid` VARCHAR(128) UNIQUE,
  `nama` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191),
  `nomor_whatsapp` VARCHAR(32) NOT NULL,
  `alamat` TEXT,
  `membership_type` VARCHAR(64) NOT NULL DEFAULT '1 Bulan',
  `status` ENUM('Active', 'Expired', 'Pending', 'Suspended') NOT NULL DEFAULT 'Active',
  `tanggal_daftar` DATE,
  `tanggal_expired` DATE,
  `qr_token` VARCHAR(64),
  `foto_url` TEXT,
  `must_change_password` BOOLEAN DEFAULT TRUE,
  `email_verified` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_whatsapp` (`nomor_whatsapp`),
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Member Accounts (Credentials / Auth hashes)
CREATE TABLE IF NOT EXISTS `member_accounts` (
  `id` VARCHAR(128) NOT NULL,
  `member_id` VARCHAR(128) NOT NULL,
  `uid` VARCHAR(128),
  `nama` VARCHAR(191),
  `nomor_whatsapp` VARCHAR(32),
  `email` VARCHAR(191),
  `password_hash` VARCHAR(255) NOT NULL,
  `must_change_password` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_acc_whatsapp` (`nomor_whatsapp`),
  INDEX `idx_acc_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Registrations (Applications & Renewals)
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` VARCHAR(128) NOT NULL,
  `nama` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191),
  `nomor_whatsapp` VARCHAR(32) NOT NULL,
  `alamat` TEXT,
  `membership_type` VARCHAR(64) NOT NULL,
  `payment_method` VARCHAR(64) NOT NULL,
  `bukti_pembayaran` TEXT,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  `is_renewal` BOOLEAN DEFAULT FALSE,
  `member_id` VARCHAR(128),
  `uid` VARCHAR(128),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reg_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Transactions (Financial Ledger)
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(128) NOT NULL,
  `member` VARCHAR(191) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `method` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Success',
  `date` VARCHAR(64),
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_trans_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Check-ins (Attendance Logs)
CREATE TABLE IF NOT EXISTS `checkins` (
  `id` VARCHAR(128) NOT NULL,
  `member_id` VARCHAR(128) NOT NULL,
  `member_name` VARCHAR(191),
  `checkin_time` DATETIME NOT NULL,
  `checkout_time` DATETIME,
  `latitude` DECIMAL(10,8),
  `longitude` DECIMAL(11,8),
  `status` VARCHAR(32) DEFAULT 'Completed',
  PRIMARY KEY (`id`),
  INDEX `idx_checkin_member` (`member_id`),
  INDEX `idx_checkin_time` (`checkin_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Gym Equipment Inventory
CREATE TABLE IF NOT EXISTS `equipment` (
  `id` VARCHAR(128) NOT NULL,
  `nama` VARCHAR(191) NOT NULL,
  `kategori` VARCHAR(64),
  `kondisi` VARCHAR(32) DEFAULT 'Baik',
  `jumlah` INT DEFAULT 1,
  `foto_url` TEXT,
  `deskripsi` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Workout Programs
CREATE TABLE IF NOT EXISTS `workout_programs` (
  `id` VARCHAR(128) NOT NULL,
  `member_id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT,
  `source` VARCHAR(32) DEFAULT 'manual',
  `status` ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  `preferences` JSON,
  `sessions` JSON,
  `current_week` INT DEFAULT 1,
  `total_weeks` INT DEFAULT 8,
  `completed_session_ids` JSON,
  `start_date` DATE,
  `end_date` DATE,
  `version` INT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `activated_at` DATETIME,
  PRIMARY KEY (`id`),
  INDEX `idx_program_member` (`member_id`),
  INDEX `idx_program_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Workout Sessions (AI Form Coach Logs)
CREATE TABLE IF NOT EXISTS `workout_sessions` (
  `id` VARCHAR(128) NOT NULL,
  `member_id` VARCHAR(128) NOT NULL,
  `exercise_name` VARCHAR(128) NOT NULL,
  `reps_completed` INT DEFAULT 0,
  `form_score` DECIMAL(5,2) DEFAULT 0.00,
  `feedback_summary` TEXT,
  `duration_seconds` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_workout_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Gym Configs
CREATE TABLE IF NOT EXISTS `configs` (
  `key_name` VARCHAR(64) NOT NULL,
  `config_value` JSON NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

