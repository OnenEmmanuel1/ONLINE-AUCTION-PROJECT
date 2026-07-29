-- BidSecure Seed SQL Script
USE `bidsecure_db`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `login_audit`;
TRUNCATE TABLE `fraud_flags`;
TRUNCATE TABLE `transactions`;
TRUNCATE TABLE `bids`;
TRUNCATE TABLE `listing_images`;
TRUNCATE TABLE `listings`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- Default password for all seed users is: Password123!
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `contact`, `address`, `role`, `account_status`, `can_bid`, `can_sell`) VALUES
(1, 'System Administrator', 'admin@bidsecure.com', '$2a$10$wE99VjQy8yT2S7XW2L8b/.8W3E.1Z0E7B3W4.8B4C.5D.6E.7F.8G', '+2348011112222', '10 Marian Road, Calabar', 'admin', 'active', 1, 1),
(2, 'Effiong Bassey', 'effiong@calabar.com', '$2a$10$wE99VjQy8yT2S7XW2L8b/.8W3E.1Z0E7B3W4.8B4C.5D.6E.7F.8G', '+2348022223333', '45 Watt Market Street, Calabar', 'user', 'active', 1, 1),
(3, 'Blessing Ekpenyong', 'blessing@calabar.com', '$2a$10$wE99VjQy8yT2S7XW2L8b/.8W3E.1Z0E7B3W4.8B4C.5D.6E.7F.8G', '+2348033334444', '12 Mary Slessor Avenue, Calabar', 'user', 'active', 1, 1),
(4, 'Okon Edet', 'okon@calabar.com', '$2a$10$wE99VjQy8yT2S7XW2L8b/.8W3E.1Z0E7B3W4.8B4C.5D.6E.7F.8G', '+2348044445555', '88 Murtala Mohammed Highway, Calabar', 'user', 'active', 1, 1),
(5, 'Arit Archibong', 'arit@calabar.com', '$2a$10$wE99VjQy8yT2S7XW2L8b/.8W3E.1Z0E7B3W4.8B4C.5D.6E.7F.8G', '+2348055556666', '23 Target Road, Calabar', 'user', 'active', 1, 1);

INSERT INTO `listings` (`id`, `seller_id`, `title`, `description`, `category`, `starting_price`, `reserve_price`, `current_highest_bid`, `start_at`, `end_at`, `status`) VALUES
(1, 2, 'Nike x Off-White - Air Force 1 "Volt" (Size 43)', 'Limited edition deadstock Virgil Abloh collaboration sneakers with original zip-tie tag and box provenance.', 'Fashion & Jewelry', 150000.00, 180000.00, 240000.00, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY, 'active'),
(2, 3, 'Louis Vuitton x Murakami - Monogram Multicolore Bag Set', 'Rare collector Takashi Murakami canvas luxury handbag. Includes dust bag and certificate of authenticity.', 'Fashion & Jewelry', 450000.00, 500000.00, 580000.00, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 7 DAY, 'active'),
(3, 4, 'Bearbrick x BAPE - Shark Camo Edition 1000% Figure', 'Iconic Medicom Toy collectible figure in 70cm height. Pristine condition with original packaging.', 'Art & Antiques', 350000.00, 400000.00, 420000.00, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY, 'active'),
(4, 3, 'iPhone 14 Pro Max - Deep Purple (256GB)', 'Neatly used Apple iPhone 14 Pro Max with battery health at 94%. Factory unlocked, includes box and fast charger.', 'Electronics', 520000.00, 550000.00, 610000.00, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 7 DAY, 'active'),
(5, 2, 'Toyota Camry 2015 XLE - Foreign Used', 'Clean V6 engine, leather interior, duty fully paid at Calabar Sea Port. Ready for immediate drive-off.', 'Vehicles', 3500000.00, 4000000.00, 4200000.00, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 2 DAY, 'sold'),
(6, 5, 'Authentic Calabar Basalt Monolith Miniature Sculpture', 'Hand-carved basalt monolith replica from Ikom, Cross River State. Exceptional historic African craftsmanship.', 'Cultural Artifacts', 80000.00, 100000.00, 125000.00, NOW(), NOW() + INTERVAL 7 DAY, 'active');

INSERT INTO `listing_images` (`id`, `listing_id`, `filename`, `storage_path`) VALUES
(1, 1, 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop', 'external'),
(2, 2, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop', 'external'),
(3, 3, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop', 'external'),
(4, 4, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop', 'external'),
(5, 5, 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&auto=format&fit=crop', 'external'),
(6, 6, 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop', 'external');

INSERT INTO `bids` (`id`, `listing_id`, `bidder_id`, `amount`, `placed_at`) VALUES
(1, 1, 3, 160000.00, NOW() - INTERVAL 12 HOUR),
(2, 1, 4, 200000.00, NOW() - INTERVAL 10 HOUR),
(3, 1, 5, 240000.00, NOW() - INTERVAL 1 HOUR),
(4, 4, 2, 540000.00, NOW() - INTERVAL 5 HOUR),
(5, 4, 4, 610000.00, NOW() - INTERVAL 2 HOUR);

INSERT INTO `transactions` (`id`, `listing_id`, `winner_id`, `seller_id`, `final_price`, `payment_reference_encrypted`, `status`, `completed_at`) VALUES
(1, 5, 5, 2, 4200000.00, 'ENCRYPTED_REF_PAY_CALABAR_CAMRY_982371', 'completed', NOW() - INTERVAL 1 DAY);

INSERT INTO `fraud_flags` (`id`, `user_id`, `listing_id`, `flag_type`, `details`, `reviewed`) VALUES
(1, 2, 1, 'SELF_BIDDING', 'User tried to place bid on own listing #1 (Nike Off-White).', 0),
(2, 4, 2, 'RAPID_CONSECUTIVE_BIDS', 'User placed 4 bids in 15 seconds on Listing #2.', 0);
