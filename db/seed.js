'use strict';

/**
 * BidSecure — Database Seeder Script
 * Inserts default admin, 4 users, real-world image listings across all statuses, bid history, completed transaction, and fraud flags.
 */

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const engine = require('../engine/aucpEngine');

async function seed() {
  console.log('[Seed] Starting BidSecure Database Seeding with Real Image Assets...');

  try {
    // 1. Clear existing data
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('TRUNCATE TABLE login_audit');
    await db.query('TRUNCATE TABLE fraud_flags');
    await db.query('TRUNCATE TABLE transactions');
    await db.query('TRUNCATE TABLE bids');
    await db.query('TRUNCATE TABLE listing_images');
    await db.query('TRUNCATE TABLE listings');
    await db.query('TRUNCATE TABLE users');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 2. Users (1 Admin + 4 Regular Users with dual buyer/seller capabilities)
    const [adminResult] = await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
       VALUES (?, ?, ?, ?, ?, 'admin', 'active', 1, 1)`,
      ['System Administrator', 'admin@bidsecure.com', passwordHash, '+2348011112222', '10 Marian Road, Calabar', 'admin']
    );

    const [user1] = await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
      ['Effiong Bassey', 'effiong@calabar.com', passwordHash, '+2348022223333', '45 Watt Market Street, Calabar', 'user']
    );

    const [user2] = await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
      ['Blessing Ekpenyong', 'blessing@calabar.com', passwordHash, '+2348033334444', '12 Mary Slessor Avenue, Calabar', 'user']
    );

    const [user3] = await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
      ['Okon Edet', 'okon@calabar.com', passwordHash, '+2348044445555', '88 Murtala Mohammed Highway, Calabar', 'user']
    );

    const [user4] = await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
      ['Arit Archibong', 'arit@calabar.com', passwordHash, '+2348055556666', '23 Target Road, Calabar', 'user']
    );

    const u1Id = user1.insertId;
    const u2Id = user2.insertId;
    const u3Id = user3.insertId;
    const u4Id = user4.insertId;

    console.log('[Seed] Users seeded successfully.');

    // 3. Seed Listings across statuses with REAL high-res online image URLs
    const now = new Date();
    const future3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const future7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const past5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    // Listing 1: Nike x Off-White Air Force 1 "Volt" (Sneakers)
    const [l1] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        u1Id,
        'Nike x Off-White - Air Force 1 "Volt" (Size 43)',
        'Limited edition deadstock Virgil Abloh collaboration sneakers with original zip-tie tag and box provenance.',
        'Fashion & Jewelry',
        150000.00,
        180000.00,
        240000.00,
        past2Days,
        future3Days
      ]
    );
    const l1Id = l1.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l1Id, 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop', 'external']);

    // Listing 2: Louis Vuitton x Murakami Limited Collector's Bag
    const [l2] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        u2Id,
        'Louis Vuitton x Murakami - Monogram Multicolore Bag Set',
        'Rare collector Takashi Murakami canvas luxury handbag. Includes dust bag and certificate of authenticity.',
        'Fashion & Jewelry',
        450000.00,
        500000.00,
        580000.00,
        past2Days,
        future7Days
      ]
    );
    const l2Id = l2.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l2Id, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop', 'external']);

    // Listing 3: Bearbrick x BAPE Camo Edition 1000%
    const [l3] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        u3Id,
        'Bearbrick x BAPE - Shark Camo Edition 1000% Figure',
        'Iconic Medicom Toy collectible figure in 70cm height. Pristine condition with original packaging.',
        'Art & Antiques',
        350000.00,
        400000.00,
        420000.00,
        past2Days,
        future3Days
      ]
    );
    const l3Id = l3.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l3Id, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop', 'external']);

    // Listing 4: iPhone 14 Pro Max Deep Purple
    const [l4] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        u2Id,
        'iPhone 14 Pro Max - Deep Purple (256GB)',
        'Neatly used Apple iPhone 14 Pro Max with battery health at 94%. Factory unlocked, includes box and fast charger.',
        'Electronics',
        520000.00,
        550000.00,
        610000.00,
        past2Days,
        future7Days
      ]
    );
    const l4Id = l4.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l4Id, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop', 'external']);

    // Listing 5: Toyota Camry 2015 XLE (Sold)
    const [l5] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sold')`,
      [
        u1Id,
        'Toyota Camry 2015 XLE - Foreign Used',
        'Clean V6 engine, leather interior, duty fully paid at Calabar Sea Port. Ready for immediate drive-off.',
        'Vehicles',
        3500000.00,
        4000000.00,
        4200000.00,
        past5Days,
        past2Days
      ]
    );
    const l5Id = l5.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l5Id, 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&auto=format&fit=crop', 'external']);

    // Listing 6: Historic Calabar Basalt Monolith Carving
    const [l6] = await db.query(
      `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        u4Id,
        'Authentic Calabar Basalt Monolith Miniature Sculpture',
        'Hand-carved basalt monolith replica from Ikom, Cross River State. Exceptional historic African craftsmanship.',
        'Cultural Artifacts',
        80000.00,
        100000.00,
        125000.00,
        now,
        future7Days
      ]
    );
    const l6Id = l6.insertId;
    await db.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
      [l6Id, 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop', 'external']);

    console.log('[Seed] Listings & images seeded successfully.');

    // 4. Sample Bids
    await db.query(
      `INSERT INTO bids (listing_id, bidder_id, amount, placed_at) VALUES 
       (?, ?, 160000.00, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
       (?, ?, 200000.00, DATE_SUB(NOW(), INTERVAL 10 HOUR)),
       (?, ?, 240000.00, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
       (?, ?, 540000.00, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
       (?, ?, 610000.00, DATE_SUB(NOW(), INTERVAL 2 HOUR))`,
      [l1Id, u2Id, l1Id, u3Id, l1Id, u4Id, l4Id, u1Id, l4Id, u3Id]
    );

    // Transaction for Sold Listing #5 (Toyota Camry)
    const rawRef = `SIM-PAY-CALABAR-CAMRY-982371-COMPLETED`;
    const encryptedRef = engine.encryptData(rawRef);

    await db.query(
      `INSERT INTO transactions (listing_id, winner_id, seller_id, final_price, payment_reference_encrypted, status, completed_at)
       VALUES (?, ?, ?, ?, ?, 'completed', DATE_SUB(NOW(), INTERVAL 1 DAY))`,
      [l5Id, u4Id, u1Id, 4200000.00, encryptedRef]
    );

    // Fraud Flags
    await db.query(
      `INSERT INTO fraud_flags (user_id, listing_id, flag_type, details, reviewed) VALUES 
       (?, ?, 'SELF_BIDDING', 'User tried to place bid on own listing #1 (Nike Off-White).', 0),
       (?, ?, 'RAPID_CONSECUTIVE_BIDS', 'User placed 4 bids in 15 seconds on Listing #2.', 0)`,
      [u1Id, l1Id, u3Id, l2Id]
    );

    console.log('[Seed] Database Seeding Completed Successfully! 🎉');

  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
    throw err;
  } finally {
    process.exit(0);
  }
}

seed();
