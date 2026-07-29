-- BidSecure: Secure Online Auction Portal Schema for Calabar
-- Engine: InnoDB, Charset: utf8mb4

CREATE DATABASE IF NOT EXISTS `bidsecure_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `bidsecure_db`;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS `login_audit`;
DROP TABLE IF EXISTS `fraud_flags`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `bids`;
DROP TABLE IF EXISTS `listing_images`;
DROP TABLE IF EXISTS `listings`;
DROP TABLE IF EXISTS `users`;

-- 1. Users table (Capability-based role flags: can_bid, can_sell + admin role)
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `contact` VARCHAR(50) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `account_status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `can_bid` TINYINT(1) NOT NULL DEFAULT 1,
  `can_sell` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Listings table
CREATE TABLE `listings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `seller_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `starting_price` DECIMAL(12,2) NOT NULL,
  `reserve_price` DECIMAL(12,2) DEFAULT NULL,
  `current_highest_bid` DECIMAL(12,2) DEFAULT 0.00,
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME NOT NULL,
  `status` ENUM('draft', 'active', 'ended', 'sold', 'unsold') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Listing Images table
CREATE TABLE `listing_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `storage_path` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bids table (Append-only immutable log)
CREATE TABLE `bids` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL,
  `bidder_id` INT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `placed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`bidder_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Transactions table (Winning bids, payment reference encrypted via AES-256-GCM)
CREATE TABLE `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL UNIQUE,
  `winner_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `final_price` DECIMAL(12,2) NOT NULL,
  `payment_reference_encrypted` TEXT DEFAULT NULL,
  `status` ENUM('pending_payment', 'completed') NOT NULL DEFAULT 'pending_payment',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`winner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Fraud Flags table (Rule-based detection in aucpEngine.js)
CREATE TABLE `fraud_flags` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `listing_id` INT DEFAULT NULL,
  `flag_type` VARCHAR(100) NOT NULL,
  `details` TEXT NOT NULL,
  `flagged_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed` TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Login Audit table for failed login tracking & security monitoring
CREATE TABLE `login_audit` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL,
  `success` TINYINT(1) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
